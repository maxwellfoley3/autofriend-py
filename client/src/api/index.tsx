import axios from 'axios'
const SERVER_ROUTE = 'http://localhost:83'
import { BotsConfig } from '../types'

export async function getConfig() {
  return axios.get(`${SERVER_ROUTE}/config`).then((res) => {
    return res.data
  })
  .catch(err=>console.error(err))
}

export async function getFinetuneDoc(botName: string) {
  return axios.get(`${SERVER_ROUTE}/finetune-doc?botName=${botName}`).then((res) => {
    return res.data
  })
}
export async function postConfig(config: BotsConfig, token:string) {
	return axios.post(`${SERVER_ROUTE}/config`, config, {headers: {Authorization: token}})
}

export async function promptGpt({ settings }: any) : Promise<string> {
  return 'Silly GPT-3'
}

export async function tweet(botName: string, token:string) {
  return axios.post(`${SERVER_ROUTE}/tweet`, {botName}).then((res) => {
    return res.data
  })
}

export async function login(username: string, password: string) {
  return axios.post(`${SERVER_ROUTE}/login`, {username, password})
}
