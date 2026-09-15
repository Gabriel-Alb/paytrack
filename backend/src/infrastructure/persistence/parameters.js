// Bind placeholders without touching quoted SQL, identifiers or comments.
// The repository SQL uses @name or ?; only the driver placeholder syntax varies.
export function bindParameters(sql, args, dialect) {
  const named = args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0]);
  const values = [];
  let position = 0;
  const text = sql.replace(/'(?:(?:'')|[^'])*'|"(?:(?:"")|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|@[a-zA-Z_]\w*|\?/g, token => {
    if (token[0] !== '@' && token !== '?') return token;
    const value = token === '?' ? args[position++] : args[0]?.[token.slice(1)];
    if (value === undefined || (token[0] === '@' && !named)) throw new Error('Parâmetro SQL ausente.');
    // NULL has no ambiguous PostgreSQL parameter type in optional filters.
    if (value === null) return 'NULL';
    values.push(value);
    return dialect === 'postgres' ? `$${values.length}` : '?';
  });
  return { text, values };
}
