import { useMemo, useState } from 'react'

export default function usePagination(items, resetKey, pageSize = 20) {
  const [pagination, setPagination] = useState({ key: resetKey, page: 1 })
  const requestedPage = pagination.key === resetKey ? pagination.page : 1
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(requestedPage, pageCount)

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  function setPage(nextPage) {
    setPagination({
      key: resetKey,
      page: Math.max(1, Math.min(Number(nextPage) || 1, pageCount)),
    })
  }

  return { pageItems, page, pageCount, pageSize, setPage }
}
