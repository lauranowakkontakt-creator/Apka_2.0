import { format, parseISO } from 'date-fns'
import { pl } from 'date-fns/locale'

// Drobiazgi używane przez kilka widoków IPL.

export const TODAY = () => format(new Date(), 'yyyy-MM-dd')
export const dzien = (d) => { try { return format(parseISO(d), 'd MMM yyyy', { locale: pl }) } catch { return d || '' } }
export const dzienDlugi = (d) => { try { return format(parseISO(d), 'EEEE, d MMMM yyyy', { locale: pl }) } catch { return d || '' } }
