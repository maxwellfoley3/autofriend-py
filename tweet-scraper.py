import tweepy
import os 
import json
from dotenv import load_dotenv
load_dotenv()

f = open(os.path.abspath('./accounts-config.json'), 'r')
config = json.load(f)

print('whatever3')

twitter_client = tweepy.Client(
	consumer_key=os.environ['TWITTER_APP_KEY'],
	consumer_secret=os.environ['TWITTER_APP_SECRET'],
	access_token=config['twitter']['reality__gamer']['accessToken'],
	access_token_secret=config['twitter']['reality__gamer']['accessSecret']
)	
print('whatever')
user = twitter_client.get_user(username='GRIFTSH0P', user_auth=True)

with open('readme.txt', 'w') as f:
	count = 0
	next_token = None
	while count < 4:
		print(count)
		tweets = twitter_client.get_users_tweets(user.data.id, expansions='referenced_tweets.id', user_auth=True, pagination_token=next_token)
		for tweet in tweets.data:

			if tweet.text.startswith('RT'):
				continue
			
			if tweet.text.startswith('@'):
				print(dir(tweet))
				print('tweet.id', tweet.id)
				print('tweet.text', tweet.text)
				print('tweet.referenced_tweets', tweet.referenced_tweets)

			# if trimmed tweet is a blank string, ignore it 
			if tweet.text.strip() == '':
				continue

			# write tweet to file
			f.write(tweet.text)
			f.write('\n')

		next_token=tweets.meta['next_token']
		count+=1

	print('tweets', tweets)
