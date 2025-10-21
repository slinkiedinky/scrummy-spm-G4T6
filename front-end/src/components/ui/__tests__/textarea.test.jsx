import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Textarea } from '../textarea'

describe('Textarea Component', () => {
  it('renders without crashing', () => {
    const { container } = render(<Textarea />)
    expect(container.querySelector('textarea')).toBeInTheDocument()
  })

  it('renders with placeholder', () => {
    render(<Textarea placeholder="Enter text here" />)
    expect(screen.getByPlaceholderText('Enter text here')).toBeInTheDocument()
  })

  it('handles user input', async () => {
    const user = userEvent.setup()
    render(<Textarea />)
    const textarea = screen.getByRole('textbox')

    await user.type(textarea, 'Hello World')
    expect(textarea).toHaveValue('Hello World')
  })

  it('applies custom className', () => {
    const { container } = render(<Textarea className="custom-textarea" />)
    const textarea = container.querySelector('textarea')
    expect(textarea).toHaveClass('custom-textarea')
  })

  it('forwards ref correctly', () => {
    const ref = { current: null }
    render(<Textarea ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('handles disabled state', () => {
    render(<Textarea disabled />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('handles readOnly state', () => {
    render(<Textarea readOnly value="Read only text" />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('readOnly')
  })

  it('sets initial value', () => {
    render(<Textarea value="Initial value" onChange={() => {}} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveValue('Initial value')
  })
})
