from unicodedata import name
import discord
import json
import time
import re
import random
from os.path import abspath
from bot.QualityFilters import tweet_has_complete_sentences, tweet_has_meaningful_words, tweet_passes_bad_word_check
from bot.Utility import repeatedly_query
from bot.Config import config

MINUTE_LIMIT = 3
ONE_MINUTE = 60

HIVE_CHANNEL_ID = 1011005608931102812
SINGLE_REPLY = 'single-reply'
CONTEXT_REPLY = 'context-reply'
class DiscordBot:
	name = None
	gpt_3_model = None
	reply_frequency = None
	_open_ai_client = None
	_discord_client = None
	__minute_count = None

	def __init__(self, **kwargs):
		self.name = kwargs['name']
		self.gpt_3_model = kwargs['gpt_3_model']
		self.reply_frequency = float(kwargs['reply_frequency'])
		self._open_ai_client = kwargs['open_ai_client']
		self._discord_client = discord.Client(
			intents=discord.Intents(messages=True, guilds=True)
		)
		self.__minute_count = { 'count': 0, 'minute': time.time() % ONE_MINUTE }
		self.reply_style = kwargs['reply_style']

	# Minute count = how much this account has tweeted in the last minute
	# The variable is in the form { Minute: [num], count: [num] }
	# Representing the current minute (time since epoch % ONE_MINUTE) and the number of messages this minute
	# TODO: not sure if this works, the bots have gotten in endless loops before, or maybe a minute is too short
	def check_and_update_minute_count(self):
		now = time.time_ns()
		if now % ONE_MINUTE > self.__minute_count.minute:
			self.__minute_count.minute = now & ONE_MINUTE
			self.__minute_count.count = 0
		
		self.__minute_count.count += 1
		if self.__minute_count.count > MINUTE_LIMIT:
			raise "Minute limit reached!"

	async def generate_response(self, prompt):
		valid_tweet_found = False
		response_text = ''
		attempts = 0

		print('generating response', self.gpt_3_model)

		while (not valid_tweet_found) and (attempts < 6):
			response = await repeatedly_query(
				lambda: self._open_ai_client.Completion.create(
					engine=self.gpt_3_model, 
					prompt=prompt,
					temperature=0.9,
					max_tokens=54,
					frequency_penalty=2.0,
					presence_penalty=2.0,
					stop=['\n', '###']
				), 
				error_message_to_watch_for = 'That model is still being loaded. Please try again shortly.' 
			)
			response_text = response['choices'][0]['text']
			valid_tweet_found = response_text.strip() != '' 
			if 'qualityFiltersOn' in config and config['qualityFiltersOn']:
				valid_tweet_found = valid_tweet_found and tweet_has_complete_sentences(self._open_ai_client, response_text) 
				valid_tweet_found = valid_tweet_found and tweet_has_meaningful_words(self._open_ai_client, response_text) 
				valid_tweet_found = valid_tweet_found and tweet_passes_bad_word_check(self._open_ai_client, response_text)
			
		return response_text
	
	async def reply(self, message):
		try:
			message_text = message.content
			channel = message.channel
			if self.reply_style == SINGLE_REPLY:
				prompt = f'Reply to: {message_text}'
			elif self.reply_style == CONTEXT_REPLY:
				prompt = ""
				async for msg in channel.history(limit=15):
					# print(msg)
					# We need to reverse the order, it will return the most recent messages first
					# Strip out the @mentions
					prompt = msg.author.name + ": " + re.sub(r'<@.*>\s', '', msg.content) + "\n" + prompt
				
				prompt = "The following is a Discord conversation between multiple participants with distinct personalities:\n\n" + prompt
				prompt+=self.name + ":"

			print(f'Replying to {message_text} from {self.name}')
			response_text = await self.generate_response(prompt)
			await message.reply(response_text)
		except Exception as e:
			print(f'{self.name} reply failed: {e}')

	# This function will fire whenever there is a new message in Discord
	async def on_message_create(self, message):
		# Look for messages tagging this bot and respond
		did_mention_this_user = list(filter(lambda member: member.name == self.name, message.mentions))
		if did_mention_this_user:
			if message.author.bot:
				# only 50/50 chance of responding to bots
				if random.randint(1,2) > 1:
					await self.reply(message)
			else:
				await self.reply(message)
		# Look for messages in the HIVE channel and respond
		elif message.channel.id == HIVE_CHANNEL_ID:
			# 1 in reply_frequency chance of responding to messages in the HIVE channel
			if random.random() < self.reply_frequency:
				await self.reply(message)

	def start(self, loop):
		@self._discord_client.event
		async def on_ready():
			print(f'Logged in as {self._discord_client.user}!')
		
		@self._discord_client.event
		async def on_message(message):
			await self.on_message_create(message)
		
		loop.create_task(self._discord_client.start(config['discord'][self.name]['token']))