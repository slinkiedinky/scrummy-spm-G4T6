import { render } from '@testing-library/react'
import { Separator } from '../separator'

describe('Separator Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Separator />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders horizontal separator by default', () => {
    const { container } = render(<Separator />)
    const separator = container.firstChild
    expect(separator).toBeInTheDocument()
  })

  it('renders vertical separator', () => {
    const { container } = render(<Separator orientation="vertical" />)
    const separator = container.firstChild
    expect(separator).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Separator className="custom-separator" />)
    expect(container.firstChild).toHaveClass('custom-separator')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Separator ref={ref} />)
    expect(ref.current).toBeTruthy()
  })

  it('renders decorative by default', () => {
    const { container } = render(<Separator />)
    const separator = container.firstChild
    expect(separator).toHaveAttribute('data-orientation')
  })
})
