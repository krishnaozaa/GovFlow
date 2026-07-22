# ADR 0004: Fee AST and money

**Status:** accepted

Fee formulas reuse a closed arithmetic/conditional AST evaluated with `Decimal`, explicit rounding, effective dates, and integer minor-unit output. Model output is only a candidate formula; application validation and generated boundary cases control publication.
