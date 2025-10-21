import { render, screen } from '@testing-library/react'
import { Label } from '../label'

describe('Label Component', () => {
  it('renders children correctly', () => {
    render(<Label>Test Label</Label>)
    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  it('applies htmlFor attribute', () => {
    render(<Label htmlFor="test-input">Label</Label>)
    const label = screen.getByText('Label')
    expect(label).toHaveAttribute('for', 'test-input')
  })

  it('applies custom className', () => {
    const { container } = render(<Label className="custom-label">Label</Label>)
    const label = container.firstChild
    expect(label).toHaveClass('custom-label')
  })

  it('renders as label element', () => {
    const { container } = render(<Label>Label</Label>)
    expect(container.firstChild.tagName).toBe('LABEL')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Label ref={ref}>Label</Label>)
    expect(ref.current).toBeInstanceOf(HTMLLabelElement)
  })
})
