def tweet_has_complete_sentences(open_ai_client, tweet):
	print('Checking to see if tweet has complete sentences:', tweet)
	res = open_ai_client.Completion.create(
		model='text-davinci-002',
		prompt='''Please respond 'A' if this fragment of text begins at the beginning 
		of a sentence and ends at the end of a sentence, and 'B' if it starts in 
		the middle of a sentence or cuts off before it reaches the end of a sentence: 
		{0}'''.format(tweet),
		temperature=0,
		max_tokens=54
	)
	answer = res['choices'][0]['text']
	if answer.strip() == 'A':
		print('Tweet is complete sentence')
		return True
	
	print('Tweet is fragmentary')
	return False


def tweet_has_meaningful_words(open_ai_client, tweet):
	print('Checking to see if tweet has meaningful words:', tweet)
	res = open_ai_client.Completion.create(
		model='text-davinci-002', 
		prompt='''Please respond 'A' if this fragment of text contains only meaningful 
		words, and 'B' if it contains nonsense words: 
		{0}'''.format(tweet),
		temperature=0, 
		max_tokens=54,
	)
	answer = res['choices'][0]['text']
	if answer.strip() == 'A':
		print('Tweet has meaningful words')
		return True

	print('Tweet has nonsense words')
	return False


# Only word bad enough to explicitly blacklist for now
# Cornelius Kennington tweeted it the other day, smh
def tweet_passes_bad_word_check (open_ai_client, tweet):
	return 'nigger' not in tweet