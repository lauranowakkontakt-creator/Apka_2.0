// Plan „Cofnij import" — czysta logika, bez Firebase.
//
// transactions: [{ id, source, importedFrom, accountId, categoryId, type }]
// accounts:     [{ id, name, balance }]
// categories:   dokument settings/categories albo null
//
// Usuwamy: transakcje z source === 'import'; konta, których po tym nie używa
// żadna transakcja i które mają saldo 0 (to te założone przez import);
// kategorie o id z prefiksem imp_ (zakłada je import), których nie używa
// żadna pozostała transakcja.

export function planImportCleanup(transactions, accounts, categories) {
  const imported = transactions.filter(t => t.source === 'import')
  const kept = transactions.filter(t => t.source !== 'import')
  const files = [...new Set(imported.map(t => String(t.importedFrom || '').split(' · ')[0]).filter(Boolean))]

  const usedAcc = new Set(kept.map(t => t.accountId).filter(Boolean))
  const touched = new Set(imported.map(t => t.accountId).filter(Boolean))
  const accs = accounts.filter(a => touched.has(a.id) && !usedAcc.has(a.id) && !Number(a.balance))

  let cats = null, removedCats = 0
  if (categories) {
    const used = new Set(kept.map(t => `${t.type}|${t.categoryId}`))
    cats = {}
    for (const type of ['expense', 'income']) {
      const list = categories[type] || []
      const next = list.filter(c => !String(c.id).startsWith('imp_') || used.has(`${type}|${c.id}`))
      removedCats += list.length - next.length
      cats[type] = next
    }
    if (!removedCats) cats = null
  }
  return { transactions: imported.map(t => t.id), accounts: accs, categories: cats, removedCats, files }
}
