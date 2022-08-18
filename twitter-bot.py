import requests
import random
import json
import tweepy

config_file = open('config.js', 'r')
config_text = config_file.read()
config_text = config_text[config_text.index('{'):]

print(config_text)
config = json.loads(config_text)

print('Running twitter bot')

word_site = "https://www.mit.edu/~ecprice/wordlist.10000"
response = requests.get(word_site)
word_list = response.content.splitlines()

twitter_api = tweepy.Client(
	consumer_key= config['twitter']['appKey'],
	consumer_secret = config['twitter']['appSecret'],
	access_token = config['twitter']['accessToken'],
	access_token_secret = config['twitter']['accessSecret']
)

print(twitter_api)

def tweet_milady():
		print('Sending gpt-3 request')
		r = requests.post( 
			'https://api.openai.com/v1/completions',
			headers = {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config['openAiApiKey'],
			},
			json = {
				'model': 'curie:ft-personal:milady-small-unsplit-stopsequence-2022-08-04-21-47-28', 
				'prompt': random.choice(word_list).decode('utf-8'), 
				'temperature': .9, 
				'max_tokens': 54,
				'stop': ['###']
			}
		)
		tweetText = json.loads(r.text)['choices'][0]['text']
		print('Tweeting: ' + tweetText)
		twitter_api.create_tweet(text=tweetText)

tweet_milady()