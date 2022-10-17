import json
import os
import time
import asyncio
import random
from enum import Enum

import tweepy
from bot.QualityFilters import tweet_has_complete_sentences, tweet_has_meaningful_words, tweet_passes_bad_word_check
from bot.Config import config

WORDS = open('./data/wordlist.txt').read().splitlines()

HOURLY_LIMIT = 20
ONE_HOUR = 60 * 60
TEN_MINUTES = 60 * 10

class PromptStyle(Enum):
		BLANK = 1
		DICTIONARY = 2
class TwitterBot:
	name = None
	gpt_3_model = None
	tweet_frequency = None
	_twitter_client = None
	_open_ai_client = None
	__hour_count = None
	follower_count = None
	id = None
	prompt_style = PromptStyle.BLANK

	def __init__(self, **kwargs): # _open_ai_client, name, gpt_3_model, tweet_frequency):
		name = kwargs['name']
		if not config['twitter'][name] or not config['twitter'][name]['accessToken'] or not config['twitter'][name]['accessSecret']:
			raise f'No account found for ${name}'

		self._open_ai_client = kwargs['open_ai_client']
		self.name = kwargs['name']
		self.gpt_3_model = kwargs['gpt_3_model']
		self._twitter_client = tweepy.Client(
				consumer_key=os.environ['TWITTER_APP_KEY'],
				consumer_secret=os.environ['TWITTER_APP_SECRET'],
				access_token=config['twitter'][name]['accessToken'],
				access_token_secret=config['twitter'][name]['accessSecret']
		)	
		self.tweet_frequency = kwargs['tweet_frequency']
		self.__hour_count = { 'hour': time.time() % ONE_HOUR, 'count': 0 }
		self.follower_count = 0

		# Prompt style
		if 'promptStyle' in config['twitter'][name]:
			if config['twitter'][name]['promptStyle'] == 'dictionary':
				self.prompt_style = PromptStyle.DICTIONARY
			else:
				self.prompt_style = PromptStyle.BLANK

		try:
			me = self._twitter_client.get_me()
		except Exception as e:
			print(f'Unable to log into Twitter account for "{self.name}"')
			raise e
		self.id = me.data.id
		
	def start(self, loop):
		# Tweet on a schedule
		async def tweet_regularly():
			self.tweet()
			await asyncio.sleep(self.tweet_frequency)
			await tweet_regularly()
		loop.create_task(tweet_regularly())

	# Hour count = how much this account has tweeted in the last hour
	# The variable is in the form { hour: [num], count: [num] }
	# Representing the current hour (time since epoch % ONE_HOUR) and the number of tweets this hour
	def update_hour_count_and_check_is_limit_reached(self):
		now = time.time()
		if now % ONE_HOUR > self.__hour_count['hour']:
			self.__hour_count['hour'] = now and ONE_HOUR
			self.__hour_count['count'] = 0
		
		self.__hour_count['count'] += 1
		if self.__hour_count['count'] > HOURLY_LIMIT: 
			return True
		else:
			return False

	def tweet(self):
		try:
			if not self.update_hour_count_and_check_is_limit_reached():
				prompt = "###"
				if self.prompt_style == PromptStyle.DICTIONARY:
					# Prompt with random word from the dictionary
					prompt = random.choice(WORDS)+'###'
					
				tweet_text = self.generate_response(prompt)
				print(f'{self.name} tweeting: {tweet_text}')
				return self._twitter_client.create_tweet(text=tweet_text)
		except Exception as e:
			print(f'{self.name} tweeting failed: {e}')

	def generate_response(self, prompt):
		valid_tweet_found = False
		response_text = ''
		attempts = 0
		# Keep trying to generate a valid tweet until we reach the maximum number of attempts
		while not valid_tweet_found and attempts < 6:
			attempts+=1
			res = self._open_ai_client.Completion.create(
				model=self.gpt_3_model, 
				prompt=prompt,
				temperature=.9, 
				max_tokens=54,
				stop=['###']
			)
			response_text = res['choices'][0]['text']
			print(f'{self.name} got gpt-3 response for input ${prompt}: {response_text}')

			# Reject tweets that have incomplete sentences, nonsense words, or bad words
			valid_tweet_found = response_text.strip() != '' 
			if 'qualityFiltersOn' in config and config['qualityFiltersOn']:
				valid_tweet_found = valid_tweet_found and tweet_has_complete_sentences(self._open_ai_client, response_text) 
				valid_tweet_found = valid_tweet_found and tweet_has_meaningful_words(self._open_ai_client, response_text) 
				valid_tweet_found = valid_tweet_found and tweet_passes_bad_word_check(self._open_ai_client, response_text)
		
		print("\n\n")
		return response_text

	def reply(self, reply_to_tweet_text, reply_to_tweet_id):
		self.update_hour_count_and_check_is_limit_reached()
		try:
			tweet_text = self.generate_response(f'Reply to "{reply_to_tweet_text}"###')
			print('Replying:', tweet_text)
			return self._twitter_client.create_tweet(text=tweet_text, in_reply_to_tweet_id=reply_to_tweet_id)
		except Exception as e:
			print('Tweeting failed:', e)