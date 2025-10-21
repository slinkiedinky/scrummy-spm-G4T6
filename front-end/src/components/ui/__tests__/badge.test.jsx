import { render, screen } from '@testing-library/react'
import { Badge } from '../badge'

describe('Badge Component', () => {
  it('renders children correctly', () => {
    render(<Badge>Test Badge</Badge>)
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('applies default variant', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.firstChild
    expect(badge).toBeInTheDocument()
  })

  it('applies destructive variant', () => {
    const { container } = render(<Badge variant="destructive">Destructive</Badge>)
    const badge = container.firstChild
    expect(badge).toBeInTheDocument()
  })

  it('applies outline variant', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>)
    const badge = container.firstChild
    expect(badge).toBeInTheDocument()
  })

  it('applies secondary variant', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>)
    const badge = container.firstChild
    expect(badge).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Badge className="custom-badge">Custom</Badge>)
    const badge = container.firstChild
    expect(badge).toHaveClass('custom-badge')
  })

  it('renders as span by default', () => {
    const { container } = render(<Badge>Badge</Badge>)
    const badge = container.firstChild
    expect(badge.tagName).toBe('SPAN')
  })
})
