import { Expo } from 'expo-server-sdk'
import { NotificationRule } from '../db/models/NotificationRule.js'
import { PriceWindow } from '../db/models/PriceWindow.js'
import { User } from '../db/models/User.js'
import { Mute } from '../db/models/Mute.js'

const expo = new Expo()

export async function sendPush(token: string, title: string, body: string, data = {}) {
  try {
    if (!Expo.isExpoPushToken(token)) {
      console.warn('Invalid token', token)
      return false
    }
    const ticket = await expo.sendPushNotificationsAsync([{ to: token, sound: 'default', title, body, data }])
    console.log('Push ticket', ticket)
    return true
  } catch (e) {
    console.error('sendPush failed', e)
    return false
  }
}

// Evaluate rules + windows for a given deal and send pushes to matching users
export async function evaluateAndPush(deal: any) {
  // naive implementation: find all rules and windows that match and notify their users
  const rules = await NotificationRule.find({ enabled: true }).lean()
  const windows = await PriceWindow.find({ enabled: true }).lean()

  // simple matching
  const matches: Record<string, { userId: string; reasons: string[] }> = {}

  for (const r of rules) {
    const q = (r.query || '').toLowerCase()
    const dev = (deal.game?.developer || '').toLowerCase()
    if (r.type === 'studio' && dev.includes(q)) {
      matches[String(r.userId)] = matches[String(r.userId)] || { userId: String(r.userId), reasons: [] }
      matches[String(r.userId)].reasons.push(`studio:${r.query}`)
    }
    if (r.type === 'game' && (deal.game?.title || '').toLowerCase().includes(q)) {
      matches[String(r.userId)] = matches[String(r.userId)] || { userId: String(r.userId), reasons: [] }
      matches[String(r.userId)].reasons.push(`game:${r.query}`)
    }
  }

  for (const w of windows) {
    const p = deal.priceFinal
    if ((w.min === undefined || p >= w.min) && (w.max === undefined || p <= w.max)) {
      matches[String(w.userId)] = matches[String(w.userId)] || { userId: String(w.userId), reasons: [] }
      matches[String(w.userId)].reasons.push(`price:${w.min || '-'}-${w.max || '-'}`)
    }
  }

  // now notify users (respecting mutes)
  for (const k of Object.keys(matches)) {
    try {
      const u = await User.findById(k).lean()
      if (!u || !u.pushToken) continue
      // check mutes
      const mute = await Mute.findOne({ userId: k, targetType: 'game', targetId: String(deal.appId || deal._id), until: { $gt: new Date() } }).lean()
      if (mute) continue

      const title = `Oferta: ${deal.game?.title}`
      const body = `${deal.store?.name} — ${deal.priceFinal} (${Math.round(deal.discountPct || 0)}% off)`
      await sendPush(u.pushToken, title, body, { dealId: deal._id })
    } catch (e) {
      console.warn('evaluateAndPush user notify error', e)
    }
  }
}
