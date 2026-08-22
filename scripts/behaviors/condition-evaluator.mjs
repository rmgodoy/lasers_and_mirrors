import { BaseBehavior } from "./base-behavior.mjs";

/**
 * Evaluator for conditional assertions and boolean expressions.
 * Supports comparison operators, AND/OR logic, parentheses, and variable/flag resolution.
 */
export class ConditionEvaluator {
  /**
   * Evaluate a condition configuration or expression string.
   * @param {object|string} condition - Either a structured condition config or an expression string
   * @param {object} context - Current execution context
   * @returns {boolean}
   */
  static evaluate(condition, context) {
    if (!condition) return true;

    // 1. Structured clauses list: { logic: "AND"|"OR", clauses: [...] }
    if (typeof condition === "object") {
      if (Array.isArray(condition.clauses) && condition.clauses.length > 0) {
        const logic = (condition.logic ?? "AND").toUpperCase();
        if (logic === "OR") {
          return condition.clauses.some(clause => this.evaluate(clause, context));
        }
        return condition.clauses.every(clause => this.evaluate(clause, context));
      }

      // Single clause object: { left, operator, right }
      if ("left" in condition || "operator" in condition) {
        return this.evaluateClause(condition, context);
      }

      // Expression string inside object: { expression: "..." }
      if (typeof condition.expression === "string") {
        return this.evaluateExpression(condition.expression, context);
      }
    }

    // 2. String expression: "$var == 5 && flag:open == true"
    if (typeof condition === "string") {
      return this.evaluateExpression(condition, context);
    }

    return true;
  }

  /**
   * Evaluate a single atomic comparison clause.
   * @param {object} clause - { left, operator, right }
   * @param {object} context - Execution context
   * @returns {boolean}
   */
  static evaluateClause(clause, context) {
    const leftRaw = clause.left;
    const operator = (clause.operator ?? "==").toLowerCase().trim();
    const rightRaw = clause.right;

    const left = BaseBehavior.resolveValue(leftRaw, context);
    const right = BaseBehavior.resolveValue(rightRaw, context);

    return this.compare(left, operator, right);
  }

  /**
   * Compare two resolved values using an operator.
   * @param {*} left
   * @param {string} op
   * @param {*} right
   * @returns {boolean}
   */
  static compare(left, op, right) {
    switch (op) {
      case "==":
      case "eq":
      case "=":
        return String(left ?? "") === String(right ?? "");
      case "!=":
      case "neq":
      case "<>":
        return String(left ?? "") !== String(right ?? "");
      case ">":
      case "gt":
        return Number(left) > Number(right);
      case ">=":
      case "gte":
        return Number(left) >= Number(right);
      case "<":
      case "lt":
        return Number(left) < Number(right);
      case "<=":
      case "lte":
        return Number(left) <= Number(right);
      case "contains":
        if (Array.isArray(left)) return left.includes(right);
        return String(left ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
      case "!contains":
        if (Array.isArray(left)) return !left.includes(right);
        return !String(left ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
      case "is_true":
      case "is true":
      case "truthy":
        return Boolean(left) && left !== "false" && left !== 0;
      case "is_false":
      case "is false":
      case "falsy":
        return !left || left === "false" || left === 0;
      case "is_empty":
        if (left === null || left === undefined || left === "") return true;
        if (Array.isArray(left) && left.length === 0) return true;
        return false;
      case "is_not_empty":
        if (left === null || left === undefined || left === "") return false;
        if (Array.isArray(left) && left.length === 0) return false;
        return true;
      default:
        return false;
    }
  }

  /**
   * Safe parser & evaluator for boolean expressions with AND, OR, parentheses, and comparisons.
   * @param {string} exprStr
   * @param {object} context
   * @returns {boolean}
   */
  static evaluateExpression(exprStr, context) {
    if (!exprStr || exprStr.trim() === "") return true;
    const tokens = this._tokenize(exprStr);
    if (tokens.length === 0) return true;

    let index = 0;

    const peek = () => tokens[index];
    const consume = (expectedType = null) => {
      const tok = tokens[index++];
      if (expectedType && tok?.type !== expectedType) {
        throw new Error(`Unexpected token ${tok?.value ?? "EOF"}, expected ${expectedType}`);
      }
      return tok;
    };

    // Parser functions: OrExpr -> AndExpr -> PrimaryExpr
    const parseOr = () => {
      let left = parseAnd();
      while (peek()?.type === "OR") {
        consume("OR");
        const right = parseAnd();
        left = left || right;
      }
      return left;
    };

    const parseAnd = () => {
      let left = parseNot();
      while (peek()?.type === "AND") {
        consume("AND");
        const right = parseNot();
        left = left && right;
      }
      return left;
    };

    const parseNot = () => {
      if (peek()?.type === "NOT") {
        consume("NOT");
        return !parseNot();
      }
      return parsePrimary();
    };

    const parsePrimary = () => {
      const tok = peek();
      if (!tok) return true;

      // Grouping: ( ... )
      if (tok.type === "LPAREN") {
        consume("LPAREN");
        const val = parseOr();
        consume("RPAREN");
        return val;
      }

      // Comparison or Truthy evaluation
      const leftTok = consume();
      const nextTok = peek();

      if (nextTok?.type === "COMPARE_OP") {
        const opTok = consume("COMPARE_OP");
        const rightTok = consume();
        const leftVal = BaseBehavior.resolveValue(leftTok.value, context);
        const rightVal = rightTok ? BaseBehavior.resolveValue(rightTok.value, context) : null;
        return this.compare(leftVal, opTok.value, rightVal);
      }

      // Single operand truthiness
      const singleVal = BaseBehavior.resolveValue(leftTok.value, context);
      return Boolean(singleVal) && singleVal !== "false" && singleVal !== 0;
    };

    try {
      return parseOr();
    } catch (err) {
      console.warn(`LasersAndMirrors | Condition parse error: "${exprStr}"`, err);
      return false;
    }
  }

  /**
   * Tokenize an expression string.
   * @param {string} str
   * @returns {Array<{ type: string, value: string }>}
   * @private
   */
  static _tokenize(str) {
    const tokens = [];
    let i = 0;
    const len = str.length;

    while (i < len) {
      const char = str[i];

      // Whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Parentheses
      if (char === "(") { tokens.push({ type: "LPAREN", value: "(" }); i++; continue; }
      if (char === ")") { tokens.push({ type: "RPAREN", value: ")" }); i++; continue; }

      // Quoted Strings
      if (char === '"' || char === "'") {
        const quote = char;
        let s = "";
        i++;
        while (i < len && str[i] !== quote) {
          s += str[i];
          i++;
        }
        i++; // skip closing quote
        tokens.push({ type: "LITERAL", value: `"${s}"` });
        continue;
      }

      // Logical AND (&& or AND)
      if (str.startsWith("&&", i)) { tokens.push({ type: "AND", value: "&&" }); i += 2; continue; }
      // Logical OR (|| or OR)
      if (str.startsWith("||", i)) { tokens.push({ type: "OR", value: "||" }); i += 2; continue; }

      // Comparison operators: ==, !=, <=, >=, <, >
      if (str.startsWith("==", i)) { tokens.push({ type: "COMPARE_OP", value: "==" }); i += 2; continue; }
      if (str.startsWith("!=", i)) { tokens.push({ type: "COMPARE_OP", value: "!=" }); i += 2; continue; }
      if (str.startsWith("<=", i)) { tokens.push({ type: "COMPARE_OP", value: "<=" }); i += 2; continue; }
      if (str.startsWith(">=", i)) { tokens.push({ type: "COMPARE_OP", value: ">=" }); i += 2; continue; }
      if (char === "<") { tokens.push({ type: "COMPARE_OP", value: "<" }); i++; continue; }
      if (char === ">") { tokens.push({ type: "COMPARE_OP", value: ">" }); i++; continue; }
      if (char === "!" && str[i + 1] !== "=") { tokens.push({ type: "NOT", value: "!" }); i++; continue; }

      // Identifiers, keywords, operators (AND, OR, NOT, contains), literals, variables ($var, var:x, flag:y)
      let word = "";
      while (i < len && !/[\s()!<>=&|'"]/.test(str[i])) {
        word += str[i];
        i++;
      }

      const upper = word.toUpperCase();
      if (upper === "AND") tokens.push({ type: "AND", value: "AND" });
      else if (upper === "OR") tokens.push({ type: "OR", value: "OR" });
      else if (upper === "NOT") tokens.push({ type: "NOT", value: "NOT" });
      else if (word.toLowerCase() === "contains" || word.toLowerCase() === "!contains") {
        tokens.push({ type: "COMPARE_OP", value: word.toLowerCase() });
      } else {
        tokens.push({ type: "LITERAL", value: word });
      }
    }

    return tokens;
  }
}
