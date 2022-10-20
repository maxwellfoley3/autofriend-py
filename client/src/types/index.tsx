export type BotsConfig = {
  twitter: any;
  discord: any;
}

export type UserAndSetUser = { user: User | null; setUser: (user: User) => void; }
export type User = {
  username: string,
  token: string
}

export type BotPromptStyle = 'dictionary' | 'blank'