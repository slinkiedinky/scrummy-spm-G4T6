import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '../card'

describe('Card Components', () => {
  describe('Card', () => {
    it('renders children correctly', () => {
      render(<Card>Card Content</Card>)
      expect(screen.getByText('Card Content')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<Card className="custom-class">Content</Card>)
      const card = container.firstChild
      expect(card).toHaveClass('custom-class')
    })

    it('forwards ref correctly', () => {
      const ref = { current: null }
      render(<Card ref={ref}>Content</Card>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })
  })

  describe('CardHeader', () => {
    it('renders children correctly', () => {
      render(<CardHeader>Header Content</CardHeader>)
      expect(screen.getByText('Header Content')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<CardHeader className="header-class">Header</CardHeader>)
      const header = container.firstChild
      expect(header).toHaveClass('header-class')
    })
  })

  describe('CardTitle', () => {
    it('renders children correctly', () => {
      render(<CardTitle>Title</CardTitle>)
      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<CardTitle className="title-class">Title</CardTitle>)
      const title = container.firstChild
      expect(title).toHaveClass('title-class')
    })
  })

  describe('CardDescription', () => {
    it('renders children correctly', () => {
      render(<CardDescription>Description</CardDescription>)
      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<CardDescription className="desc-class">Description</CardDescription>)
      const desc = container.firstChild
      expect(desc).toHaveClass('desc-class')
    })
  })

  describe('CardContent', () => {
    it('renders children correctly', () => {
      render(<CardContent>Content</CardContent>)
      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<CardContent className="content-class">Content</CardContent>)
      const content = container.firstChild
      expect(content).toHaveClass('content-class')
    })
  })

  describe('CardFooter', () => {
    it('renders children correctly', () => {
      render(<CardFooter>Footer Content</CardFooter>)
      expect(screen.getByText('Footer Content')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<CardFooter className="footer-class">Footer</CardFooter>)
      const footer = container.firstChild
      expect(footer).toHaveClass('footer-class')
    })
  })

  describe('Card composition', () => {
    it('renders complete card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Title</CardTitle>
            <CardDescription>Test Description</CardDescription>
          </CardHeader>
          <CardContent>Test Content</CardContent>
          <CardFooter>Test Footer</CardFooter>
        </Card>
      )

      expect(screen.getByText('Test Title')).toBeInTheDocument()
      expect(screen.getByText('Test Description')).toBeInTheDocument()
      expect(screen.getByText('Test Content')).toBeInTheDocument()
      expect(screen.getByText('Test Footer')).toBeInTheDocument()
    })
  })
})
