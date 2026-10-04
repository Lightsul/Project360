import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BriefPage } from '../src/features/brief/BriefPage'

describe('Brief (rendu)', () => {
  it('affiche les cinq thèmes, 0/3 conditions et les montants séparés', () => {
    render(<MemoryRouter><BriefPage /></MemoryRouter>)
    for (const t of ['Responsable', 'Date et conditions', 'Portée', 'Budget', 'Factures', 'Priorités']) expect(screen.getAllByRole('heading', { name: t }).length).toBeGreaterThan(0)
    const kpis = screen.getByRole('region', { name: 'Indicateurs clés' })
    expect(within(kpis).getByText('0/3 remplies')).toBeInTheDocument()
    expect(kpis.textContent).toMatch(/204\s000\s\$/)
    expect(kpis.textContent).toMatch(/payé 132\s000\s\$/)
    expect(screen.getAllByRole('button', { name: /Ouvrir la source/ }).length).toBeGreaterThan(10)
  })
})
