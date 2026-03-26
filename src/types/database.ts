export type Plan = 'free' | 'pro' | 'premium'
export type SubscriptionPeriod = 'monthly' | '3months' | '6months' | '12months'
export type ServiceCategory = 'Cabelo' | 'Barba' | 'Combo' | 'Químicas' | 'Extra'
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type AppointmentSource = 'whatsapp' | 'web' | 'manual'
export type WhatsappStatus = 'connected' | 'disconnected' | 'connecting' | 'banned'

export interface Barbershop {
  id: string
  owner_id: string
  name: string
  slug: string
  phone: string | null
  whatsapp: string | null
  bot_name: string
  address: string | null
  city: string | null
  logo_url: string | null
  working_hours: WorkingHours
  slot_duration: number
  is_active: boolean
  plan: Plan
  trial_ends_at: string
  subscription_ends_at: string | null
  subscription_period: SubscriptionPeriod | null
  grace_period_days: number | null
  created_at: string
  updated_at: string
}

export interface WorkingHours {
  seg: DaySchedule
  ter: DaySchedule
  qua: DaySchedule
  qui: DaySchedule
  sex: DaySchedule
  sab: DaySchedule
  dom: DaySchedule
}

export interface DaySchedule {
  open: string
  close: string
  active: boolean
}

export interface Service {
  id: string
  barbershop_id: string
  name: string
  description: string | null
  duration_min: number
  price: number
  is_active: boolean
  display_order: number
  category: ServiceCategory[]
  created_at: string
}

export interface Customer {
  id: string
  barbershop_id: string
  name: string
  phone: string
  notes: string | null
  total_visits: number
  last_visit_at: string | null
  created_at: string
}

export interface Appointment {
  id: string
  barbershop_id: string
  customer_id: string | null
  service_id: string | null
  start_time: string
  end_time: string
  status: AppointmentStatus
  source: AppointmentSource
  notes: string | null
  reminder_sent: boolean
  confirmed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
  updated_at: string
  // joins
  customer?: Customer
  service?: Service
}

export interface WhatsappInstance {
  id: string
  barbershop_id: string
  instance_name: string
  phone_number: string | null
  status: WhatsappStatus
  qr_code: string | null
  connected_at: string | null
  created_at: string
  updated_at: string
}

export interface AppointmentFull extends Omit<Appointment, 'customer' | 'service'> {
  customer_name: string | null
  customer_phone: string | null
  service_name: string | null
  service_duration: number | null
  service_price: number | null
}

export interface BotSession {
  id: string
  barbershop_id: string
  phone: string
  state: string
  context: Record<string, unknown>
  last_message_at: string
  created_at: string
}
