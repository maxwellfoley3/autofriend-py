import asyncio
async def repeatedly_query(func, **kwargs):
	timeout = kwargs['timeout'] if 'timeout' in kwargs else 10
	num_attempts = kwargs['num_attempts'] if 'num_attempts' in kwargs else 10
	error_message_to_watch_for = kwargs['error_message_to_watch_for'] if 'error_message_to_watch_for' in kwargs else None
	try:
		return func()
	except Exception as e:
		if num_attempts > 0 and (error_message_to_watch_for == None or error_message_to_watch_for in str(e)):
			print(f'Error message "{error_message_to_watch_for}" found in error message. Retrying...')
			await asyncio.sleep(timeout)
			kwargs['num_attempts'] = num_attempts - 1
			return await repeatedly_query(func, **kwargs)
		else:
			raise e