import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppBrand } from '../components/AppBrand'
import { APP_NAME } from '../lib/appConfig'

const controller = 'PhanterAI Creative Agency'
const privacyEmail = 'atendimento@phanterai.com'

function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 leading-7 text-ink">{children}</div>
    </section>
  )
}

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  const appName = APP_NAME || 'Phanter Tools'

  useEffect(() => {
    document.title = `${title} | ${appName}`
    return () => {
      document.title = appName
    }
  }, [appName, title])

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <Link to="/login" aria-label={`${appName} — entrar`}>
            <AppBrand />
          </Link>
          <Link to="/login" className="text-sm font-medium text-brand-ink underline">
            Entrar
          </Link>
        </header>
        <article className="py-8">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <div className="mt-5 leading-7 text-ink">{children}</div>
        </article>
        <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-sm">
          <Link to="/termos-de-servico" className="text-brand-ink underline">
            Termos de Serviço
          </Link>
          <Link to="/politica-de-privacidade" className="text-brand-ink underline">
            Política de Privacidade
          </Link>
          <a className="text-brand-ink underline" href={`mailto:${privacyEmail}`}>
            Contato: {privacyEmail}
          </a>
        </footer>
      </div>
    </main>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de Serviço">
      <p>
        Estes termos regulam o uso do {APP_NAME || 'Phanter Tools'}, serviço operado por {controller}
        para organizar publicações e automações de mensagens em contas conectadas.
      </p>

      <DocumentSection title="Acesso e contas conectadas">
        <p>
          O acesso ao serviço é feito por convite e por provedores de autenticação disponíveis na tela
          de entrada. Você deve usar somente contas do Instagram ou do Facebook que controla ou está
          autorizado a administrar, e manter seus dados de acesso protegidos.
        </p>
        <p>
          Ao conectar uma conta, você autoriza o serviço a usar as permissões concedidas para executar
          as ações que solicitar. Você pode desconectar a conta pelo painel.
        </p>
      </DocumentSection>

      <DocumentSection title="Conteúdo e publicações">
        <p>
          Você mantém seus direitos sobre os textos, imagens e vídeos enviados. Para prestar o serviço,
          você permite que ele armazene, processe e envie esse conteúdo às plataformas conectadas,
          conforme as publicações e automações que configurar.
        </p>
        <p>
          Você é responsável por ter os direitos e autorizações necessários para o conteúdo e por
          revisar as publicações e automações configuradas. O envio ou horário de publicação pode
          depender da disponibilidade, das regras e dos limites das plataformas de terceiros.
        </p>
      </DocumentSection>

      <DocumentSection title="Uso permitido">
        <p>
          Use o serviço de acordo com a legislação aplicável, estes termos e as regras das plataformas
          conectadas. Não o use para acessar contas sem autorização, infringir direitos de terceiros ou
          interferir no funcionamento ou na segurança do serviço.
        </p>
      </DocumentSection>

      <DocumentSection title="Serviços de terceiros">
        <p>
          Instagram, Facebook, Google e outros provedores são serviços de terceiros, sujeitos aos
          próprios termos e políticas. O serviço não controla suas decisões, disponibilidade, APIs ou
          alterações de regras e permissões.
        </p>
      </DocumentSection>

      <DocumentSection title="Encerramento e alterações">
        <p>
          Você pode excluir sua conta em Configurações no painel autenticado. A exclusão remove os dados
          associados à conta mantidos pelo serviço; ela não apaga publicações já enviadas às plataformas
          de terceiros.
        </p>
        <p>
          O serviço pode ser atualizado para corrigir problemas, atender requisitos técnicos ou mudar
          funcionalidades. Estes termos também podem ser atualizados; a versão vigente ficará publicada
          nesta página.
        </p>
      </DocumentSection>

      <DocumentSection title="Contato">
        <p>
          Dúvidas sobre estes termos: <a className="text-brand-ink underline" href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.
        </p>
      </DocumentSection>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade">
      <p>
        Esta política explica como {controller}, responsável pelo {APP_NAME || 'Phanter Tools'},
        trata dados pessoais quando você usa o serviço.
      </p>

      <DocumentSection title="Dados tratados">
        <ul className="list-disc space-y-2 pl-6">
          <li>Dados de login fornecidos pelo provedor, como nome, e-mail, foto e identificador da conta.</li>
          <li>
            Dados das contas conectadas, como identificadores e nomes de usuário, além de tokens de
            acesso necessários às integrações e dados das Páginas do Facebook conectadas.
          </li>
          <li>
            Conteúdo e dados de uso do serviço: arquivos enviados, textos, legendas, agendamentos,
            resultados de publicação, configurações e automações.
          </li>
          <li>
            Dados de perfis e Páginas consultados para análises, como informações de perfil e métricas
            disponibilizadas pelas plataformas.
          </li>
          <li>
            Quando uma automação de mensagens é usada, identificadores e registros de conversas e
            mensagens de seguidores necessários para executar e exibir essa automação.
          </li>
          <li>
            Dados técnicos necessários para manter a sessão, proteger o serviço e diagnosticar falhas.
          </li>
        </ul>
      </DocumentSection>

      <DocumentSection title="Finalidades e integrações">
        <p>
          Usamos esses dados para autenticar você, manter sua sessão, conectar as contas que escolher,
          preparar e acompanhar publicações, executar automações solicitadas, exibir análises e prestar
          suporte operacional.
        </p>
        <p>
          Quando você conecta uma conta, os dados e instruções necessários são enviados à Meta/Instagram
          ou ao Facebook para realizar as ações solicitadas. Os provedores de login recebem os dados
          necessários à autenticação. O serviço também depende de fornecedores de infraestrutura para
          armazenar e operar seus componentes.
        </p>
      </DocumentSection>

      <DocumentSection title="Armazenamento e segurança">
        <p>
          Os tokens de integração são armazenados criptografados. A sessão do painel usa um cookie
          HttpOnly, com validade de até sete dias. Adotamos controles técnicos para proteger os dados,
          mas nenhum sistema conectado à internet pode garantir segurança absoluta.
        </p>
        <p>
          O texto das mensagens de automação é removido após até 90 dias. Eventos técnicos de webhook
          expiram em até 30 dias, e notificações lidas são removidas após 30 dias. Arquivos de mídia
          podem ser removidos automaticamente quando deixam de ser necessários para publicações ativas.
        </p>
      </DocumentSection>

      <DocumentSection title="Compartilhamento e retenção">
        <p>
          Não vendemos dados pessoais. O compartilhamento ocorre com as plataformas que você conecta,
          com os provedores de autenticação escolhidos e com fornecedores necessários à operação do
          serviço, limitado ao que cada finalidade exige.
        </p>
        <p>
          Mantemos os dados enquanto a conta estiver ativa ou enquanto forem necessários para as
          finalidades descritas. Ao excluir a conta pelo painel, removemos os dados associados mantidos
          pelo serviço. Conteúdo já publicado e cópias mantidas por terceiros seguem as regras dessas
          plataformas e precisam ser tratados diretamente com elas.
        </p>
      </DocumentSection>

      <DocumentSection title="Seus direitos e contato">
        <p>
          Você pode solicitar confirmação e acesso aos dados, correção de informações incompletas ou
          incorretas e outras medidas previstas na legislação aplicável. Para excluir sua conta, entre
          no painel e acesse Configurações. Essa ação exige autenticação; não existe um link público de
          exclusão.
        </p>
        <p>
          Para exercer seus direitos ou tirar dúvidas sobre dados pessoais, contate {controller} pelo e-mail{' '}
          <a className="text-brand-ink underline" href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.
        </p>
      </DocumentSection>
    </LegalLayout>
  )
}
