#!/usr/bin/env python

import tweepy

# From your app settings page
CONSUMER_KEY = "O5H1nRmWshJm5BoYb6dua1UUF"
CONSUMER_SECRET = "pXwQCmlE8tGp0XNjXFqQjgNPAPmd44DTAXWVwAIrkR9FKn4PCD"

auth = tweepy.OAuthHandler(CONSUMER_KEY, CONSUMER_SECRET)
auth.secure = True
auth_url = auth.get_authorization_url()

print('Please authorize: ' + auth_url)

verifier = input('PIN: ').strip()

auth.get_access_token(verifier)

print("ACCESS_KEY = '%s'" % auth.access_token.key)
print("ACCESS_SECRET = '%s'" % auth.access_token.secret)