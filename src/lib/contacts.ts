export interface ContactInfo {
  whatsapp: string
  whatsappFormatted: string
  whatsappLink: string
  phone: string
  phoneFormatted: string
  phoneLink: string
  email: string
  emailLink: string
}

export const SYSTEM_CONTACTS = {
  whatsapp: '(82) 99106-9350',
  whatsappRaw: '5582991069350',
  whatsappLink: 'https://wa.me/5582991069350',
  phone: '(82) 99106-9350',
  phoneRaw: '+5582991069350',
  phoneLink: 'tel:+5582991069350',
  email: 'valdknupp@gmail.com',
  emailLink: 'mailto:valdknupp@gmail.com',
} as const
