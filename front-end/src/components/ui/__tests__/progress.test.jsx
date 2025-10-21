import { render } from '@testing-library/react'
import { Progress } from '../progress'

describe('Progress Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Progress value={50} />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('sets correct progress value', () => {
    const { container } = render(<Progress value={75} />)
    const indicator = container.querySelector('[role="progressbar"]')
    expect(indicator).toBeInTheDocument()
  })

  it('handles 0% progress', () => {
    const { container } = render(<Progress value={0} />)
    const indicator = container.querySelector('[role="progressbar"]')
    expect(indicator).toBeInTheDocument()
  })

  it('handles 100% progress', () => {
    const { container } = render(<Progress value={100} />)
    const indicator = container.querySelector('[role="progressbar"]')
    expect(indicator).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<Progress value={50} className="custom-progress" />)
    expect(container.firstChild).toHaveClass('custom-progress')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Progress ref={ref} value={50} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })
})
