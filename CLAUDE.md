# Working rules for this repo

- Read `docs/BRIEF.md` first. `docs/research/blueprint.html` has the research and links.
- Workflow: brainstorm with Superpowers (`superpowers:brainstorming`), write the plan with
  `superpowers:writing-plans` into `docs/superpowers/plans/`, then build with
  `superpowers:subagent-driven-development`, one focused subagent per task. Keep SDD notes in
  `.superpowers/sdd/<date>-<topic>/`.
- Use the Opus model for coding sessions.
- Small commits with clear messages; keep tests green before each push.
- The README must always list install steps and the commands to use after install.
- Install these plugins at user (global) scope if missing: Superpowers (obra/superpowers),
  HyperFrames (`heygen-com/hyperframes`, `hyperframes@hyperframes`) and Ponytail
  (`claude plugin marketplace add DietrichGebert/ponytail`, `claude plugin install ponytail@ponytail`).
- Code with Ponytail on (simplest working solution, reuse before writing). Run `/ponytail-review`
  on each task's diff before committing.
