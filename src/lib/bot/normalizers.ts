/**
 * Remove @s.whatsapp.net, +55, espaços e hífens do JID do WhatsApp.
 * Entrada:  "5511999999999@s.whatsapp.net"  ou  "+55 11 99999-9999"
 * Saída:    "5511999999999"
 */
export function normalizePhone(raw: string): string {
  return raw
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/^\+/, '')
    .replace(/[\s\-().]/g, '')
}

/**
 * Normaliza texto de entrada do cliente: trim + minúsculas.
 */
export function normalizeText(text: string): string {
  return text.trim().toLowerCase()
}
