import { useState } from "react";
import { TerminalButton } from "./TerminalButton";
import { formatMoney, parseAmount } from "../game/format";
import type { GameCommand, GameConfig, GameState } from "../game/types";

interface FinancePanelProps {
  config: GameConfig;
  state: GameState;
  dispatch: (command: GameCommand) => void;
}

export function FinancePanel({ config, state, dispatch }: FinancePanelProps) {
  const [bankAmount, setBankAmount] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const atBank = state.player.locationId === config.serviceLocations.bank;
  const atLoan = state.player.locationId === config.serviceLocations.loanShark;

  return (
    <section className="terminal-panel finance-panel" aria-label="Banking and debt">
      <h2>BANKING / DEBT</h2>
      <dl className="stats-list">
        <div>
          <dt>Bank balance</dt>
          <dd>{formatMoney(config, state.player.bank)}</dd>
        </div>
        <div>
          <dt>Loan debt</dt>
          <dd className="money-bad">{formatMoney(config, state.player.debt)}</dd>
        </div>
        <div>
          <dt>Debt interest</dt>
          <dd>{config.debtInterest}%</dd>
        </div>
        <div>
          <dt>Bank interest</dt>
          <dd>{config.bankInterest}%</dd>
        </div>
      </dl>

      {atBank ? (
        <div className="inline-form">
          <input
            aria-label="Bank amount"
            placeholder="amount"
            value={bankAmount}
            onChange={(event) => setBankAmount(event.target.value)}
          />
          <TerminalButton onClick={() => dispatch({ type: "deposit", amount: parseAmount(bankAmount) })}>DEPOSIT</TerminalButton>
          <TerminalButton onClick={() => dispatch({ type: "withdraw", amount: parseAmount(bankAmount) })}>WITHDRAW</TerminalButton>
        </div>
      ) : (
        <p className="panel-caption">Bank access: Bronx.</p>
      )}

      {atLoan ? (
        <div className="inline-form">
          <input
            aria-label="Loan payment"
            placeholder="amount"
            value={loanAmount}
            onChange={(event) => setLoanAmount(event.target.value)}
          />
          <TerminalButton tone="warn" onClick={() => dispatch({ type: "payLoan", amount: parseAmount(loanAmount) })}>
            PAY LOAN
          </TerminalButton>
          <TerminalButton onClick={() => setLoanAmount(String(Math.min(state.player.cash, state.player.debt)))}>
            MAX
          </TerminalButton>
        </div>
      ) : (
        <p className="panel-caption">Loan shark: Bronx.</p>
      )}
    </section>
  );
}
