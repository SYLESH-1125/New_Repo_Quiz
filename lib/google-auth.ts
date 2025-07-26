export interface GoogleAuthConfig {
  clientId: string
  redirectUri: string
}

export function getGoogleAuthUrl(config: GoogleAuthConfig, userType: "student" | "faculty"): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: userType,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string, config: GoogleAuthConfig) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to exchange code for tokens")
  }

  return response.json()
}

export async function getUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error("Failed to get user info")
  }

  return response.json()
}

/**
 * Demo helper that completes the Google OAuth flow on the client.
 * Replace with a real implementation that exchanges the `code`
 * query-param for tokens and fetches the profile from Google.
 */
export async function handleGoogleCallback(userType: "student" | "faculty") {
  // 👉 In a real app you'd parse `code` from the URL and call
  // `exchangeCodeForTokens` + `getUserInfo` here.
  // For the demo we simply return a mock Google user object.
  return {
    id: `google_${Date.now()}`,
    name: userType === "student" ? "Google Student" : "Google Faculty",
    email: userType === "student" ? "google.student@example.com" : "google.faculty@example.com",
    picture: "/placeholder.svg?height=40&width=40",
  }
}
