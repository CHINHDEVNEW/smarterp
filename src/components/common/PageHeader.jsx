export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}) {
  return (
    <header className="page-heading">
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <div className="flex items-center gap-2">
            <span className="page-eyebrow">
              <span className="size-1.5 rounded-full bg-sky-500" />
              {eyebrow}
            </span>
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
          {actions}
          {children}
        </div>
      )}
    </header>
  )
}
