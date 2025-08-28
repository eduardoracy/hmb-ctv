export default function AttemptsBadge({ count }: { count?: number }) {
    if (count == null || count === 0) return null;
    return (
        <span
            title={`${count} attempt${count === 1 ? "" : "s"}`}
            style={{
                display: "inline-block",
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#eef2ff",
                color: "#3730a3",
                marginLeft: 8,
            }}
        >
            {count}
        </span>
    );
}
