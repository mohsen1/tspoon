/// <reference path="../typings/tsd.d.ts" />

import { expect } from 'chai';
import * as chai from "chai";
import * as ts from "typescript";
import { findCodeRange, findCodePosition } from "../test-kit/index";
import { defaultCompilerOptions } from '../src/configuration';
import { Visitor, VisitorContext, transpile, TranspilerOutput } from "../src/index";
import { traverseAst } from "../src/traverse-ast";
import { TranspilerContext } from "../src/transpiler-context";
import { MutableSourceCode, Insertion } from "../src/mutable-source-code";

function applyVisitor(source: string, visitor: Visitor): TranspilerOutput {
    const ast = ts.createSourceFile("test.ts", source, defaultCompilerOptions.target, true);
    let context: TranspilerContext = new TranspilerContext();
    traverseAst(ast, visitor, context);
    const mutable = new MutableSourceCode(ast);
    mutable.execute(context.insertions);
    return {
        code: mutable.code,
        diags: context.diags,
        sourceMap: mutable.sourceMap,
        halted: context.halted
    };
}

function matchDiagRanges(expected: ts.TextRange, actual: ts.Diagnostic): void {
    chai.expect({
        start: expected.pos,
        end: expected.end
    }).to.eqls({
        start: actual.start,
        end: actual.start + actual.length
    });
}


describe("given source code and a visitor, transpiler should", ()=> {

    const source = "\nclass A {}\n\n\nclass B {}";

    const mockVisitor: Visitor = {
        filter: (node: ts.Node): boolean => {
            return node.kind == ts.SyntaxKind.ClassDeclaration;
        },
        visit: (node: ts.Node, context: VisitorContext): void => {
            context.insertLine(node.getStart(), "@blah");
            context.reportDiag(node, ts.DiagnosticCategory.Error, "Test message");
        }
    };

    const intermResult = applyVisitor(source, mockVisitor);

    const target = "\n@blah\nclass A {}\n\n\n@blah\nclass B {}";

    it("generate the correct intermediate code", ()=> {

        chai.expect(intermResult.code).to.equal(target);
    });

    it("give correct diag positions", ()=> {

        chai.expect(intermResult.diags.length).to.equal(2);

        matchDiagRanges(
            findCodeRange(source, "class A {}"),
            intermResult.diags[0]);

        matchDiagRanges(
            findCodeRange(source, "class B {}"),
            intermResult.diags[1]);
    });
});