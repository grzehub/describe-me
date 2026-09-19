import { useState } from 'react'
import { Button } from './Button'
import './styles.css'

export interface SearchBoxProps {
  placeholder?: string
  onSearch?: (query: string) => void
}

export function SearchBox({ placeholder = 'Search…', onSearch }: SearchBoxProps) {
  const [query, setQuery] = useState('')

  return (
    <form
      className="searchbox"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSearch?.(query)
      }}
    >
      <input
        type="search"
        aria-label="query"
        placeholder={placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query && (
        <Button variant="ghost" size="sm" aria-label="clear" onClick={() => setQuery('')}>
          ×
        </Button>
      )}
      <Button size="sm" type="submit" disabled={!query}>
        Search
      </Button>
    </form>
  )
}
