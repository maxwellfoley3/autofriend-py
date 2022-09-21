from bot.DiscordBot import DiscordBot
from bot.Utility import repeatedly_query
from stable.StableDiffuser import StableDiffuser, BEE_STYLE_EMBED
import os
from os.path import abspath
import asyncio
import time
import json
import re
import discord
from pymongo import MongoClient


TEST_CHANNEL_ID = 1010978005683806269
HIVE_CHANNEL_ID = 1011005608931102812
TEN_MINUTES = 60 * 10
FINETUNE_BATCH_SIZE = 100

CURRENT_CLASSIFIER_MODEL = f'curie:ft-personal:hivemind-classifier-2022-08-20-23-42-40'

class DiscordHivemindBot(DiscordBot):
	_mongo_client = None
	_stable_diffuser = None
	fine_tune_update_in_progress = False

	def __init__(self, **kwargs):
		kwargs['gpt_3_model'] = '<placeholder>' # satisfy the super class while we get our own gpt3 model from database
		super().__init__(**kwargs)
		self._mongo_client = MongoClient(os.environ['MONGO_URI'])
		self._stable_diffuser = StableDiffuser()
		self.get_current_model()

	def start(self, loop):
		super().start(loop)

		@self._discord_client.event
		async def on_ready():
			print(f'🐝 Logged in as {self._discord_client.user}!')
			await self.post_regularly_in_hive()
		
		@self._discord_client.event
		async def on_message(message):
			await self.on_message_create(message)

	def get_current_model(self):
		misc = self._mongo_client['hivemind']['misc']
		current_model = misc.find_one({ 'key': 'HIVEMIND_CURRENT_MODEL' })
		self.gpt_3_model = current_model['value']

	# Post in the hive channel every ten minutes
	async def post_regularly_in_hive(self):
		while (True):
			try:
				print('Posting in hive channel')
				new_message = await self.generate_response('###')

				image = self._stable_diffuser.generate(BEE_STYLE_EMBED)

				if not os.path.exists(os.path.join(os.getcwd(), 'images')):
					os.mkdir(os.path.join(os.getcwd(), 'images'))
				
				image_path = os.path.join(os.getcwd(), 'images', str(time.time()) + '.png')
				print('image path', image_path)
				image.save(image_path)
				
				
				channel = self._discord_client.get_channel(HIVE_CHANNEL_ID)
				await channel.send(new_message, file=discord.File(image_path))
			except Exception as e:
				print('An error occured in post_regularly_in_hive', e)
			
			await asyncio.sleep(TEN_MINUTES)

	# Fine-tune the model with the new contributions
	async def fine_tune_new_model(self):
		# Don't initiate a new fine-tune if there is already one in progress
		if self.fine_tune_update_in_progress: 
			return 
		try:
			self.fine_tune_update_in_progress = True

			# Collect all the new contributions
			mongo_database = self._mongo_client['hivemind']
			contributions = mongo_database['contributions']
			new_contributions = contributions.find({ 'addedToHivemind': False })

			# Write a file with the new fine-tuning data
			if not os.path.isdir(f'{os.getcwd()}/data/generated'):
				os.mkdir(f'{os.getcwd()}/data/generated')

			filename = f'{os.getcwd()}/data/generated/hivemind-fine-tune-{time.time()}.txt'
			f = open(filename, 'w')
			for contribution in new_contributions:
				# Strip input of user references in the form of <@userId>
				parsed_text = re.sub(r'/<@.*>\s/', '', contribution['text'])
				obj = {'prompt':'###', 'completion':f' {parsed_text}###'}
				f.write(json.dumps(obj) + "\n")

			# Upload the file to openAi through their API
			f = open(filename, 'r')
			file_upload_response = self._open_ai_client.File.create(purpose='fine-tune', file=f.read())
			
			# Send the fine-tune request
			print('Sending Hivemind fine tuning request')
			response = self._open_ai_client.FineTune.create(
				training_file=file_upload_response['id'],
				model=self.gpt_3_model,
				suffix=f'hivemind-fine-tune-{time.time()}',
				learning_rate_multiplier=0.002
			)

			# Repeatedly query to see if the fine-tune is complete
			fine_tune_id = response['id']
			fine_tune_finished = False
			attempts = 0
			while not fine_tune_finished and attempts < 20:
				attempts += 1
				fine_tune_retrieval_response = self._open_ai_client.FineTune.retrieve(fine_tune_id)
				if fine_tune_retrieval_response['status'] == 'succeeded':
					fine_tune_finished = True
					new_fine_tune_model = fine_tune_retrieval_response['model']

					# Update the model locally in the app
					self.gpt_3_model = new_fine_tune_model

					# Update the model in the database
					misc = mongo_database['misc']
					misc.update_one({ 'key': 'HIVEMIND_CURRENT_MODEL'}, { '$set': { 'value': new_fine_tune_model }  })

					# Record all contributions as having been added to the hivemind
					contributions = mongo_database['contributions']
					contributions.update_many({ 'addedToHivemind': False }, { '$set': { 'addedToHivemind': True }})

					# Send discord message notifying of update
					channel = self._discord_client.get_channel(HIVE_CHANNEL_ID)
					self.fine_tune_update_in_progress = False
					channel.send('🐝🐝🐝 HIVEMIND has updated 🐝🐝🐝')
					
				else:
					# Wait one minute and try again
					await asyncio.sleep(60)

		except Exception as e:
			self.fine_tune_update_in_progress = False
			print('An error occured while fine-tuning', e)

	# Check to see if a text could have come from the hivemind
	async def classify(self, text):
		try:
			res = await repeatedly_query(
				lambda: self._open_ai_client.Completion.create(
					model=CURRENT_CLASSIFIER_MODEL, 
					temperature=.7, 
					prompt=f'{text}###',
					max_tokens=54,
					stop=['###']
				)
			)
			response_text = res['choices'][0]['text']
			print(f'Hivemind classified {text} as {response_text}')
			# The classifier returns A for hivemind-like and B for non-hivemind-like
			return response_text.strip().startswith('A')
		except Exception as e:
			print('An error occured running the classifier', e)

	# Check to see if a text could have come from the hivemind and update it in the database if it is classified as such
	async def classify_and_record(self, text, user_id):
		is_hivemind_like = await self.classify(text)
		if is_hivemind_like:
			try:
				mongo_database = self._mongo_client['hivemind']
				contribution_count_collection = mongo_database['contributionCount'];
				contribution_count = contribution_count_collection.find_one({ 'userId': str(user_id), 'app': 'discord'})

				# Update the count of contributions for the user
				if contribution_count == None:
					contribution_count_collection.insert_one({ 'userId': str(user_id), 'app': 'discord', 'count': 1 })
				else:
					contribution_count_collection.update_one({ 'userId': str(user_id), 'app': 'discord'}, { '$inc': { 'count': 1 }})
	
				# Add new contribution to the database of contributions
				contributions = mongo_database['contributions']
				contributions.insert_one({ 'addedToHivemind':False, 'text': text, 'userId': user_id, 'app': 'discord' })
				
				# If we have 100 new records, run a new fine-tune
				# Get a count of the number of new records
				new_contributions = contributions.count_documents({ 'addedToHivemind':False })
				if new_contributions >= FINETUNE_BATCH_SIZE:
					await self.fine_tune_new_model()
					# TODO, also finetune new classifier
				
			except Exception as e:
				print('An error occured adding records to hiveminds database', e)

		return is_hivemind_like
	
	# Get number of contributions a given user has added to the hivemind
	def get_count_for_user(self, user_id):
		mongo_database = self._mongo_client['hivemind']
		contribution_count_collection = mongo_database['contributionCount']
		contribution_count = contribution_count_collection.find_one({ 'userId': str(user_id), 'app': 'discord'})
		if contribution_count:
			return contribution_count['count']
		else:
			return 0

	# Runs every time a message is posted in the discord
	# Classify & record all messages in Test or Hive channels, and then
	# do the standard responses the other bots do
	async def on_message_create(self, message):
		try:
			if (message.channel.id == TEST_CHANNEL_ID or message.channel.id == HIVE_CHANNEL_ID) and not message.author.name == self.name:
				is_hivemind_like = await self.classify_and_record(message.content, message.author.id)
				if is_hivemind_like:
					await message.add_reaction('🐝')
			await super().on_message_create(message)
		except Exception as e:
			print('An error occured in on_message_create', e)
		

	async def reply(self, message):
		try:
			parsed_input = re.sub(r'/<@.*>\s/', '', message.content)
			# Respond to !count with the number of contributions the user has made to the hivemind
			if message.content.find('!count') > -1:
				count = self.get_count_for_user(message.author.id)
				return await message.reply(f'✨ {count} ✨')	
			
			print('Replying:', parsed_input)
			reply_text = await self.generate_response(f'Reply to "{parsed_input}"###')
			print('Reply:', reply_text)
			return await message.reply(reply_text)
		except Exception as e:
			print('An error occured while hivemind was replying', e)