export const enSidecarValidation = {
  'sidecarValidation.depth': 'The sidecar configuration has too many levels.',
  'sidecarValidation.fieldUnavailable':
    'The sidecar field {name} is unavailable. Reopen the panel.',
  'sidecarValidation.reviewItems': 'Review the sidecar configuration items.',
  'sidecarValidation.fieldContract': 'The sidecar contract for {name} is unavailable.',
  'sidecarValidation.limit': 'Use a list of up to 50 sidecars.',
  'sidecarValidation.contract': 'The sidecar contract is unavailable.',
  'sidecarValidation.review': 'Review the sidecar configuration.',
  'sidecarValidation.name':
    'Use unique sidecar names that differ from the service name and contain up to 63 letters, digits or hyphens.',
  'sidecarValidation.image': 'Enter a valid image for sidecar {name}.',
  'sidecarValidation.reservedImage':
    'This image is reserved for the Rancher removal contract. Use Remove sidecar.',
  'sidecarValidation.networkMode':
    'Use container network mode to share another container’s network in this service.',
  'sidecarValidation.links':
    'Review the network and volume links between containers in the service.',
  'sidecarValidation.cycle': 'Network and volume links between sidecars cannot form cycles.',
} as const;

export const ptSidecarValidation = {
  'sidecarValidation.depth': 'O sidecar possui níveis demais.',
  'sidecarValidation.fieldUnavailable':
    'O campo {name} do sidecar não está disponível. Reabra o painel.',
  'sidecarValidation.reviewItems': 'Revise os itens de configuração do sidecar.',
  'sidecarValidation.fieldContract': 'Contrato de {name} do sidecar indisponível.',
  'sidecarValidation.limit': 'Use uma lista de até 50 sidecars.',
  'sidecarValidation.contract': 'Contrato dos sidecars indisponível.',
  'sidecarValidation.review': 'Revise a configuração dos sidecars.',
  'sidecarValidation.name':
    'Use nomes únicos de sidecar, diferentes do serviço, com até 63 letras, números ou hífen.',
  'sidecarValidation.image': 'Informe uma imagem válida para o sidecar {name}.',
  'sidecarValidation.reservedImage':
    'Esta imagem é reservada ao contrato de remoção do Rancher. Use Remover sidecar.',
  'sidecarValidation.networkMode':
    'Para compartilhar a rede de outro container do serviço, use o modo de rede container.',
  'sidecarValidation.links': 'Revise os vínculos de rede/volumes entre os containers do serviço.',
  'sidecarValidation.cycle': 'Os vínculos de rede/volumes entre sidecars não podem formar ciclos.',
} as const;
