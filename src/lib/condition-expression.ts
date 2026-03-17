type Comparator = '>' | '>=' | '<' | '<=' | '==' | '!=' | '===' | '!==';

function compare(left: string | number, op: Comparator, right: string | number): boolean {
  switch (op) {
    case '>': return Number(left) > Number(right);
    case '>=': return Number(left) >= Number(right);
    case '<': return Number(left) < Number(right);
    case '<=': return Number(left) <= Number(right);
    case '==': return left === right;
    case '!=': return left !== right;
    case '===': return left === right;
    case '!==': return left !== right;
    default: return false;
  }
}

function readQuoted(expr: string): string | null {
  const match = expr.match(/^['"](.*)['"]$/);
  if (!match) return null;
  return match[1];
}

export function evaluateConditionExpression(output: string, expression: string): boolean {
  const expr = expression.trim();
  if (!expr) return false;

  if (expr === 'true') return true;
  if (expr === 'false') return false;

  let match = expr.match(/^output\.(includes|startsWith|endsWith)\((.+)\)$/);
  if (match) {
    const fn = match[1];
    const rawArg = match[2].trim();
    const arg = readQuoted(rawArg);
    if (arg === null) return false;
    if (fn === 'includes') return output.includes(arg);
    if (fn === 'startsWith') return output.startsWith(arg);
    if (fn === 'endsWith') return output.endsWith(arg);
  }

  match = expr.match(/^output\.length\s*(>=|<=|>|<|==|!=)\s*(\d+)$/);
  if (match) {
    const op = match[1] as Comparator;
    const right = Number(match[2]);
    return compare(output.length, op, right);
  }

  match = expr.match(/^output\s*(===|!==|==|!=)\s*(.+)$/);
  if (match) {
    const op = match[1] as Comparator;
    const rightRaw = match[2].trim();
    const right = readQuoted(rightRaw);
    if (right === null) return false;
    return compare(output, op, right);
  }

  return false;
}

