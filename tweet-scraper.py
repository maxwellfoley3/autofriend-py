import tweepy
import os 
import json
import re
from dotenv import load_dotenv
import json
import argparse
import sys
load_dotenv()

parser = argparse.ArgumentParser(description='Scrape a user\'s twitter account and format it for OpenAi fine-tuning.')
parser.add_argument('username', metavar='username', type=str, help='The username of the twitter account to scrape.')
parser.add_argument("-f", "--filepath", metavar="filepath", help = "Path to the file to save the scraped tweets to. Defaults to data/bots/scrape-<username>.jsonl", default = None)
parser.add_argument("-n", "--num-tweets", metavar="num-tweets", help = "Number of tweets to retrieve. Otherwise will retrieve as much as Twitter's API allows.", default = 3500)
args = parser.parse_args()

username  = args.username
filepath = args.filepath if args.filepath is not None else f"data/bots/scrape-{args.username}.jsonl"
num_tweets = int(args.num_tweets)

f = open(os.path.abspath('./accounts-config.json'), 'r')
config = json.load(f)

twitter_client = tweepy.Client(
	bearer_token=os.environ['TWITTER_BEARER_TOKEN'],
	wait_on_rate_limit=True
)	

user = twitter_client.get_user(username=username)

paginator = tweepy.Paginator(
	twitter_client.get_users_tweets,
	user.data.id,
	expansions='referenced_tweets.id', 
)


with open(filepath, 'w') as f:
	count = 0
	for page in paginator:
		for tweet in page.data:
			if count >= num_tweets:
				exit()

			original_tweet_text = None
			tweet_text = tweet.text
			if tweet.text.startswith('RT'):
				continue
			
			if tweet.text.startswith('@'):
				response = twitter_client.get_tweet(tweet.referenced_tweets[0].id)
				if response.data is None:
					continue

				original_tweet_text = response.data.text
				original_tweet_text = re.sub(r'@[^\s]*', '', original_tweet_text)
				original_tweet_text = re.sub(r'http[^\s]*', '', original_tweet_text)
				original_tweet_text = original_tweet_text.strip()
				if original_tweet_text.strip() == '':
					continue

			tweet_text = re.sub(r'@[^\s]*', '', tweet_text)
			tweet_text = re.sub(r'http[^\s]*', '', tweet_text)
			tweet_text = tweet_text.strip()
			
			# if trimmed tweet is a blank string, ignore it 
			if tweet_text.strip() == '':
				continue

			# write tweet to file
			prompt = (f'Reply to "{original_tweet_text}"' if original_tweet_text is not None else '') + '###'
			completion = "" + tweet_text + "###"
			output = {"prompt":prompt, "completion":completion}
			f.write(json.dumps(output) + '\n')
			count += 1

exit()
