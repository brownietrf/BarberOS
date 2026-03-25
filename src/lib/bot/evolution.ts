const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!

/**
 * Envia uma mensagem de texto via Evolution API.
 * @param instance  Nome da instância registrada na Evolution API
 * @param to        Número do destinatário (somente dígitos, ex: "5511999999999")
 * @param text      Texto a enviar
 */
export async function sendMessage(
  instance: string,
  to: string,
  text: string
): Promise<void> {
  const url = `${EVOLUTION_API_URL}/message/sendText/${instance}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EVOLUTION_API_KEY}`,
    },
    body: JSON.stringify({ number: to, text }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Evolution API error ${res.status}: ${body}`)
  }
}
