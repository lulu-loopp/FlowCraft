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

/**
 * Safely evaluate a simple arithmetic expression containing only
 * numbers and the operators +, -, *, /.
 * Returns NaN if the expression is not a valid arithmetic expression.
 */
function safeArithmetic(expr: string): number {
  const sanitized = expr.replace(/\s+/g, '');
  // Length limit to prevent abuse
  if (sanitized.length > 200) return NaN;
  // Only allow digits, decimal points, and +-*/() operators
  if (!/^[0-9+\-*/.()]+$/.test(sanitized)) return NaN;
  // Prevent empty parens or double operators
  if (/\(\)/.test(sanitized) || /[+\-*/]{2,}/.test(sanitized.replace(/[()]/g, ''))) return NaN;
  // Balanced parentheses check
  let depth = 0;
  for (const ch of sanitized) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth < 0) return NaN;
  }
  if (depth !== 0) return NaN;
  try {
    const result = new Function(`"use strict"; return (${sanitized})`)() as unknown;
    return typeof result === 'number' ? result : NaN;
  } catch {
    return NaN;
  }
}

export function evaluateConditionExpression(output: string, expression: string): boolean {
  const expr = (expression ?? '').trim();
  if (!expr) return false;

  if (expr === 'true') return true;
  if (expr === 'false') return false;

  let match = expr.match(/^output\.(includes|startsWith|endsWith)\((.+)\)$/);
  if (match) {
    const fn = match[1];
    const rawArg = match[2].trim();
    const arg = readQuoted(rawArg);
    if (arg === null) return false;
    if (fn === 'includes') return (output ?? '').includes(arg);
    if (fn === 'startsWith') return (output ?? '').startsWith(arg);
    if (fn === 'endsWith') return (output ?? '').endsWith(arg);
  }

  match = expr.match(/^output\.length\s*(>=|<=|>|<|==|!=)\s*(\d+)$/);
  if (match) {
    const op = match[1] as Comparator;
    const right = Number(match[2]);
    return compare((output ?? '').length, op, right);
  }

  match = expr.match(/^output\s*(===|!==|==|!=)\s*(.+)$/);
  if (match) {
    const op = match[1] as Comparator;
    const rightRaw = match[2].trim();
    const right = readQuoted(rightRaw);
    if (right === null) return false;
    return compare(output ?? '', op, right);
  }

  // General arithmetic comparison: e.g. "1 + 1 === 2", "3 * 4 > 10"
  const cmpMatch = expr.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/);
  if (cmpMatch) {
    const leftVal = safeArithmetic(cmpMatch[1]);
    const rightVal = safeArithmetic(cmpMatch[3]);
    if (!isNaN(leftVal) && !isNaN(rightVal)) {
      return compare(leftVal, cmpMatch[2] as Comparator, rightVal);
    }
  }

  // Single arithmetic expression that evaluates to truthy/falsy
  const singleVal = safeArithmetic(expr);
  if (!isNaN(singleVal)) return !!singleVal;

  return false;
}

