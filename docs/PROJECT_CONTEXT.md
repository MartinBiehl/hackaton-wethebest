# Contexto do projeto

## Visão do produto

O iCarla apoia a operação da cantina em dois pontos:

- Carla precisa registrar vendas, atender pedidos, controlar produtos e acompanhar o fechamento do mês;
- pais, responsáveis e alunos precisam consultar as informações das próprias contas e usar os serviços da cantina sem ter acesso a dados de outras famílias.

O projeto nasceu em um hackathon de 15 horas. A solução usa React + TypeScript + Vite nos frontends, Supabase para autenticação e dados, npm workspaces no monorepo e deploys independentes na Vercel.

## Estado do MVP

### App interno iCarla

O app em `apps/vendas` já possui autenticação e telas para:

- listar, filtrar, registrar e cancelar vendas;
- gerar o fechamento mensal imprimível e o ranking dos produtos mais vendidos;
- acompanhar a fila e finalizar pedidos;
- confirmar pagamentos Pix manualmente durante a fase sem provedor integrado;
- cadastrar produtos com foto, ajustar estoque, cadastrar alunos e receber valores em aberto;
- configurar intervalos de retirada.

### Portal de pais e alunos

O app em `apps/portal` já possui cadastro e login com navegação separada por papel. Alunos podem consultar o cardápio, montar o carrinho, agendar a retirada, acompanhar pedidos e solicitar créditos. Responsáveis podem consultar os alunos vinculados, saldos, extratos, compras e limites mensais. As telas consomem a camada de serviços do Supabase e compartilham tipos e utilitários com o app de vendas.

### Dados e regras de negócio

O Supabase compartilhado já contém o esquema versionado, políticas RLS e funções atômicas para identidade, vínculos, catálogo, estoque, vendas, extrato, créditos pagos e pedidos prévios. Os tipos do banco e os utilitários usados pelos dois apps ficam em `packages/shared`.

## Critérios de sucesso

- Carla consegue concluir o fluxo de venda e consultar o fechamento do mês.
- A equipe consegue administrar pedidos, pagamentos, produtos, estoque, alunos e horários.
- Pais e alunos conseguem autenticar e ver apenas os registros permitidos para sua conta e seus vínculos.
- Limites, estoque, saldo e permissões são validados pelo banco, não apenas pela interface.
- Os dois produtos podem ser construídos e publicados separadamente a partir do mesmo repositório.

## Restrições e pendências

- A primeira versão depende de internet; gravação offline e sincronização estão fora do escopo.
- O PWA instalável do app de vendas ainda precisa ser configurado.
- Os fluxos do portal ainda precisam ser validados com contas e vínculos reais.
- A confirmação de Pix é manual até a escolha do provedor e a implementação de uma Edge Function/webhook.
- Faltam validar os fluxos completos com contas e dados reais, configurar os projetos da Vercel e definir os domínios finais.

## Referências de design

- [Figma Desktop](https://www.figma.com/design/pv3RvxrhVU6F5TDJcmJq8B/Desktop?node-id=0-1&t=fUDQbVLkXjNGg9xc-1)
- [Figma Mobile iCarla](https://www.figma.com/design/TRpC2zJyvla20VRpTKnNKx/Mobile-Icarla?node-id=0-1&t=UoVuBK5LBWQocEJV-1)
