import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isTransfer, getSubcategoryColor, CAT_COLORS,
  DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES,
} from '../src/utils/categories.js'

test('isTransfer — rozpoznaje przelewy', () => {
  assert.equal(isTransfer({ categoryId: 'transfer' }), true)
  assert.equal(isTransfer({ transferTo: 'acc2' }), true)
  assert.equal(isTransfer({ transferFrom: 'acc1' }), true)
})

test('isTransfer — zwykła transakcja i wartości puste', () => {
  assert.equal(isTransfer({ categoryId: 'jedzenie' }), false)
  assert.equal(!!isTransfer(null), false)
  assert.equal(!!isTransfer(undefined), false)
})

test('getSubcategoryColor — zwraca poprawny hex i jest deterministyczne', () => {
  const a = getSubcategoryColor('#C97A55', 0)
  const b = getSubcategoryColor('#C97A55', 0)
  assert.match(a, /^#[0-9a-fA-F]{6}$/)
  assert.equal(a, b)
})

test('getSubcategoryColor — różne indeksy dają różne odcienie', () => {
  assert.notEqual(getSubcategoryColor('#3B82F6', 0), getSubcategoryColor('#3B82F6', 1))
})

test('getSubcategoryColor — wejście nie-hex zwraca bezpieczny fallback', () => {
  assert.equal(getSubcategoryColor('niebieski', 0), 'niebieski')
  assert.equal(getSubcategoryColor(undefined, 0), '#888')
})

test('paleta CAT_COLORS — poprawne hexy bez duplikatów', () => {
  assert.equal(new Set(CAT_COLORS).size, CAT_COLORS.length)
  for (const c of CAT_COLORS) assert.match(c, /^#[0-9A-Fa-f]{6}$/)
})

test('getSubcategoryColor — jasność zostaje w bezpiecznym zakresie', () => {
  for (let i = 0; i < 8; i++) {
    assert.match(getSubcategoryColor('#000000', i), /^#[0-9a-fA-F]{6}$/)
    assert.match(getSubcategoryColor('#ffffff', i), /^#[0-9a-fA-F]{6}$/)
  }
})

test('domyślne kategorie mają unikalne id i poprawne kolory', () => {
  for (const list of [DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES]) {
    const ids = list.map(c => c.id)
    assert.equal(new Set(ids).size, ids.length)
    for (const c of list) {
      assert.ok(c.label && c.icon)
      assert.match(c.color, /^#[0-9A-Fa-f]{6}$/)
    }
  }
})

import { kolorPodkategorii, getSubcategoryColor as autoKolor } from '../src/utils/categories.js'

test('kolorPodkategorii — własny kolor wygrywa, bez niego odcień kategorii', () => {
  assert.equal(kolorPodkategorii({ color: '#123456' }, '#C97A55', 0), '#123456')
  assert.equal(kolorPodkategorii({}, '#C97A55', 2), autoKolor('#C97A55', 2))
  assert.equal(kolorPodkategorii({ color: null }, '#C97A55', 1), autoKolor('#C97A55', 1))
  assert.equal(kolorPodkategorii(undefined, '#C97A55', 0), autoKolor('#C97A55', 0))
})

test('uzgodnijNazwy — nazwy w transakcjach nadążają za zmianą w ustawieniach', async () => {
  const { etykietyKategorii, zmianyNazw } = await import('../src/utils/uzgodnijNazwy.js')
  const et = etykietyKategorii({ expense: [{ id: 'c1', label: 'Nowa nazwa', subcategories: [{ id: 's1', label: 'Sub nowa', subcategories: [{ id: 'x1', label: 'Pod nowa' }] }] }] })
  const lista = [
    { id: 'a', categoryId: 'c1', category: 'Stara', subcategoryId: 's1', subcategoryLabel: 'Sub stara', subsubcategoryId: 'x1', subsubcategoryLabel: 'Pod stara' },
    { id: 'b', categoryId: 'c1', category: 'Nowa nazwa' },
    { id: 'c', categoryId: 'nieznana', category: 'Cokolwiek' },
    { id: 'd', category: 'Bez id' },
  ]
  assert.deepEqual(zmianyNazw(lista, et), [{ id: 'a', data: { category: 'Nowa nazwa', subcategoryLabel: 'Sub nowa', subsubcategoryLabel: 'Pod nowa' } }])
})
