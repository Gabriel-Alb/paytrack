import { env } from '../../config/env.js';

const adminNotice = {
  title: 'Pagamento não efetuado',
  paragraphs: [
    'O pagamento não foi identificado até a data acordada. Por esse motivo, o acesso ao PayTrack está temporariamente bloqueado.',
    'Para regularizar a situação e restabelecer os serviços, entre em contato com o responsável pelo suporte de TI.',
  ],
};

const generalNotice = {
  title: 'Sistema temporariamente indisponível',
  paragraphs: [
    'Os serviços do PayTrack estão temporariamente indisponíveis.',
    'Entre em contato com o responsável pela empresa para que ele acione a equipe de TI e verifique a situação.',
    'Agradecemos a compreensão.',
  ],
};

export function lockedSessionUser(user) {
  if (!env.SERVICE_LOCK_ENABLED || !user) return null;
  return { id: user.id, serviceLock: user.role === 'admin' ? adminNotice : generalNotice };
}
