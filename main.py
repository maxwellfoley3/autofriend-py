from operator import truediv
from dotenv import load_dotenv
import discord
import os
import sys
import openai
import asyncio
import tweepy
import json 

from bot.TwitterBot import TwitterBot
from bot.DiscordBot import DiscordBot, SINGLE_REPLY
from bot.DiscordHivemindBot import DiscordHivemindBot
from bot.Config import config

load_dotenv()

# Mongo client
if(not 'MONGO_URI' in os.environ):
	print('MONGO_URI not found')
	sys.exit(1)

# Initialize OpenAI client
if(not 'OPENAI_API_KEY' in os.environ):
	print('OPENAI_API_KEY not found')
	sys.exit(1)

openai.api_key = os.environ['OPENAI_API_KEY']
try:
	openai.Model.list()
except Exception as e:
	print('An error occured while trying to connect to OpenAI', e)
	sys.exit(1)

# Initialize Twitter app client (per-user clients will be initialized in bot constructors)
if(not 'TWITTER_BEARER_TOKEN' in os.environ):
	print('TWITTER_BEARER_TOKEN not set')
	sys.exit(1)


loop = asyncio.new_event_loop()
#loop = None

def start_bots(loop):

	twitter_bots = []
	discord_bots = []

	for name, bot in config['twitter'].items():
		if bot['active']:
			twitter_bots.append(TwitterBot(
				open_ai_client=openai,
				name=name,
				gpt_3_model=bot['gpt3Model'],
				tweet_frequency=bot['tweetFrequency'],
				loop=loop
			))

	for name, bot in config['discord'].items():
		if bot['active']:
			bot_base = globals()[bot['extension']] if 'extension' in bot else DiscordBot
			discord_bots.append(bot_base(
				open_ai_client=openai,
				name=name,
				gpt_3_model=bot['gpt3Model'],
				reply_frequency=bot['replyFrequency'],
				loop=loop,
				reply_style=bot['replyStyle'] if bot['replyStyle'] else SINGLE_REPLY
			))
		asyncio.set_event_loop(loop)

	for twitter_bot in twitter_bots:
		print('Starting Twitter bot: ' + twitter_bot.name)
		twitter_bot.start(loop)

	for discord_bot in discord_bots:
		print('Starting Discord bot: ' + discord_bot.name)
		discord_bot.start(loop)

	return { 'discord_bots': discord_bots, 'twitter_bots': twitter_bots }

class TweetResponder(tweepy.StreamingClient):
	bots = None

	def __init__(self, bearer_token, bots, **kwargs):
		super().__init__(bearer_token, **kwargs)
		self.bots = bots

	def on_response(self, response):
		tweet = response.data
		matching_bot = None
		for bot in self.bots:
			if bot.id == tweet.in_reply_to_user_id:
				matching_bot = bot
				break

		if(matching_bot):
			matching_bot.reply(tweet.text, tweet.id)

	def on_errors(self, errors):
		print('Errors', errors)

def start_twitter_stream(bots):
	twitter_streaming_client = TweetResponder(os.environ['TWITTER_BEARER_TOKEN'], bots)

	rules = twitter_streaming_client.get_rules()
	if rules.data is not None:
		rules_idxs = list(map(lambda rule: int(rule.id), rules.data))
		twitter_streaming_client.delete_rules(rules_idxs)
	
	for bot in bots:
		twitter_streaming_client.add_rules(tweepy.StreamRule(f'to:{bot.name}') )
	twitter_streaming_client.filter(expansions=['in_reply_to_user_id'], threaded=True)

bots = start_bots(loop)
# start_twitter_stream(bots['twitter_bots'])
loop.run_forever()
