import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../input'

describe('Input Component', () => {
  it('renders input element', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('accepts and displays value', () => {
    render(<Input value="test value" readOnly />)
    expect(screen.getByDisplayValue('test value')).toBeInTheDocument()
  })

  it('handles onChange events', () => {
    const handleChange = jest.fn()
    render(<Input onChange={handleChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new value' } })

    expect(handleChange).toHaveBeenCalled()
  })

  it('can be disabled', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('accepts different input types', () => {
    const { rerender, container } = render(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')

    rerender(<Input type="password" placeholder="Password" />)
    const passwordInput = container.querySelector('input[type="password"]')
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom-input')
  })

  it('forwards ref correctly', () => {
    const ref = jest.fn()
    render(<Input ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })

  it('accepts aria attributes', () => {
    render(<Input aria-label="Test input" aria-required="true" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-label', 'Test input')
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('handles focus and blur events', () => {
    const handleFocus = jest.fn()
    const handleBlur = jest.fn()
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />)

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    expect(handleFocus).toHaveBeenCalled()

    fireEvent.blur(input)
    expect(handleBlur).toHaveBeenCalled()
  })

  it('accepts maxLength attribute', () => {
    render(<Input maxLength={10} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '10')
  })

  it('accepts pattern attribute', () => {
    render(<Input pattern="[0-9]*" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('pattern', '[0-9]*')
  })
})
