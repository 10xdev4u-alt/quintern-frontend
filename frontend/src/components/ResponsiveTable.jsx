import { useResponsive } from '../lib/responsive'

// Renders a table on tablet+ and a card list on mobile. The `rows` prop is an
// array of {key, cells: [{label, value, render?}, ...]} objects. The `card`
// prop is a function (item) => ReactNode for the mobile card.
export function ResponsiveTable({ items, renderCard, desktopTable }) {
  const { isMobile } = useResponsive();
  if (isMobile) {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id || item.key} className="bg-surface-raised border border-border rounded-md p-3">
            {renderCard(item)}
          </div>
        ))}
      </div>
    );
  }
  return desktopTable;
}
