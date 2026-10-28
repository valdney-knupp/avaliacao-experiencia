import { describe, it, expect } from 'vitest'
import { SYSTEM_CONTACTS } from './contacts'

describe('SYSTEM_CONTACTS', () => {
  it('contém exatamente os contatos especificados', () => {
    expect(SYSTEM_CONTACTS.whatsapp).toBe('(82) 99106-9350')
    expect(SYSTEM_CONTACTS.phone).toBe('(82) 99106-9350')
    expect(SYSTEM_CONTACTS.email).toBe('valdknupp@gmail.com')
  })

  it('formata os links de WhatsApp, celular e e-mail corretamente', () => {
    expect(SYSTEM_CONTACTS.whatsappLink).toBe('https://wa.me/5582991069350')
    expect(SYSTEM_CONTACTS.phoneLink).toBe('tel:+5582991069350')
    expect(SYSTEM_CONTACTS.emailLink).toBe('mailto:valdknupp@gmail.com')
  })
})
