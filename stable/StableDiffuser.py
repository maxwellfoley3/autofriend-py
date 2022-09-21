from diffusers import StableDiffusionPipeline
from PIL import Image
import os
import torch
from transformers import  CLIPTextModel, CLIPTokenizer

BEE_STYLE_EMBED = '<b>'

def load_learned_embed_in_clip(learned_embeds_path, text_encoder, tokenizer, token=None):
  loaded_learned_embeds = torch.load(learned_embeds_path, map_location="cpu")
  
  # separate token and the embeds
  trained_token = list(loaded_learned_embeds.keys())[0]
  embeds = loaded_learned_embeds[trained_token]

  # cast to dtype of text_encoder
  dtype = text_encoder.get_input_embeddings().weight.dtype
  embeds.to(dtype)

  # add the token in tokenizer
  token = token if token is not None else trained_token
  num_added_tokens = tokenizer.add_tokens(token)
  if num_added_tokens == 0:
    raise ValueError(f"The tokenizer already contains the token {token}. Please pass a different `token` that is not already in the tokenizer.")
  
  # resize the token embeddings
  text_encoder.resize_token_embeddings(len(tokenizer))
  
  # get the id for the token and assign the embeds
  token_id = tokenizer.convert_tokens_to_ids(token)
  text_encoder.get_input_embeddings().weight.data[token_id] = embeds


class StableDiffuser:
	def __init__(self):
		if not 'STABLE_DIFFUSION_PATH' in os.environ:
			raise Exception('STABLE_DIFFUSION_PATH not set')

		if not 'STABLE_DIFFUSION_DEVICE' in os.environ:
			raise Exception('STABLE_DIFFUSION_DEVICE not set')

		tokenizer = CLIPTokenizer.from_pretrained(
			os.path.join(os.environ['STABLE_DIFFUSION_PATH'], 'tokenizer')
		)
		text_encoder = CLIPTextModel.from_pretrained(
			os.path.join(os.environ['STABLE_DIFFUSION_PATH'], 'text_encoder')
		)

		load_learned_embed_in_clip(os.path.join(os.getcwd(), 'data/harmless_ai_style_learned_embeds.bin'), text_encoder, tokenizer, BEE_STYLE_EMBED)
		
		self.pipe = StableDiffusionPipeline.from_pretrained(
			# os.environ['STABLE_DIFFUSION_PATH'],
			'CompVis/stable-diffusion-v1-4',
			text_encoder=text_encoder,
  		tokenizer=tokenizer
			revision="fp16", 
 			torch_dtype=torch.float16,
		)
		
		def dummy(images, **kwargs):
			return images, False

		self.pipe.safety_checker = dummy
		print("os.environ['STABLE_DIFFUSION_DEVICE']", os.environ['STABLE_DIFFUSION_DEVICE'])

		if os.environ['STABLE_DIFFUSION_DEVICE'] != 'cpu':
			self.pipe = self.pipe.to(os.environ['STABLE_DIFFUSION_DEVICE'])
	
	def generate(self, prompt) -> Image:
		print('Generating...', prompt)
		if(os.environ['STABLE_DIFFUSION_DEVICE'] == 'cuda'):
			with torch.autocast('cuda'):
				return self.pipe(prompt=prompt, num_inference_steps=30)["sample"][0]
		else:
			return self.pipe(prompt=prompt, num_inference_steps=30)["sample"][0]
