import { cn } from '@/lib/utils'

describe('Utils - cn function', () => {
  it('merges class names correctly', () => {
    const result = cn('class1', 'class2')
    expect(result).toContain('class1')
    expect(result).toContain('class2')
  })

  it('handles conditional classes', () => {
    const result = cn('base-class', true && 'conditional-true', false && 'conditional-false')
    expect(result).toContain('base-class')
    expect(result).toContain('conditional-true')
    expect(result).not.toContain('conditional-false')
  })

  it('handles undefined and null values', () => {
    const result = cn('valid-class', undefined, null, 'another-valid')
    expect(result).toContain('valid-class')
    expect(result).toContain('another-valid')
  })

  it('handles empty strings', () => {
    const result = cn('class1', '', 'class2')
    expect(result).toContain('class1')
    expect(result).toContain('class2')
  })

  it('merges Tailwind conflicting classes correctly', () => {
    const result = cn('px-4', 'px-8')
    // tailwind-merge should keep only the last conflicting class
    expect(result).toContain('px-8')
  })

  it('handles array of classes', () => {
    const result = cn(['class1', 'class2'])
    expect(result).toContain('class1')
    expect(result).toContain('class2')
  })

  it('returns empty string when no classes provided', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('handles object syntax', () => {
    const result = cn({
      'active': true,
      'inactive': false,
      'enabled': true,
    })
    expect(result).toContain('active')
    expect(result).toContain('enabled')
    expect(result).not.toContain('inactive')
  })

  it('combines multiple input types', () => {
    const result = cn(
      'base',
      ['array1', 'array2'],
      { conditional: true },
      'string',
      undefined
    )
    expect(result).toContain('base')
    expect(result).toContain('array1')
    expect(result).toContain('array2')
    expect(result).toContain('conditional')
    expect(result).toContain('string')
  })
})
