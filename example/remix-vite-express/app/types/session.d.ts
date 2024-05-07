declare global {
  type SessionData = {
    count: number
    userId: string
  }

  type SessionFlashData = {
    error: string
  }
}

export {}
