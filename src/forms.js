import logger from './logger';
import h from 'hyperscript';
import { toCamel } from './utils';

/**
 * The default init callback.
 */
const onInit = _config => {};

/**
 * The default submit callback.
 */
const onSubmit = _config => {};

/**
 * The default success callback.
 */
const onSuccess = (config, _resp) => {
  const { h, form } = config;
  const replacement = h('div', {}, 'Thank you!');
  form.parentNode.replaceChild(replacement, form);
};

/**
 * The default error callback.
 */
const onError = (_config, _errors) => {};

/**
 * The default failure callback.
 */
const onFailure = _config => {};

/**
 * The default enable hook.
 */
const enable = config => {
  const buttons = config.form.querySelectorAll("[type='submit']:disabled");

  Array.from(buttons).forEach(button => {
    button.disabled = false;
  });
};

/**
 * The default disable hook.
 */
const disable = config => {
  const buttons = config.form.querySelectorAll("[type='submit']:enabled");

  Array.from(buttons).forEach(button => {
    button.disabled = true;
  });
};

/**
 * The default error rendering hook.
 */
const renderErrors = (config, errors) => {
  const elements = config.form.querySelectorAll('[data-sk-error]');

  const errorFor = field => {
    return errors.find(error => {
      return error.field == field;
    });
  };

  Array.from(elements).forEach(element => {
    const error = errorFor(element.dataset.skError);

    if (!error) {
      element.innerHTML = '';
      return;
    }

    const fieldConfig = config.fields[error.field] || {};
    const errorMessages = fieldConfig.errorMessages || {};
    const prefix = fieldConfig.prettyName || 'This field';
    const code = toCamel((error.code || '').toLowerCase());
    const fullMessage = errorMessages[code] || `${prefix} ${error.message}`;

    element.innerHTML = fullMessage;
  });
};

/**
 * Submits the form.
 */
const submit = async (client, config) => {
  const {
    id,
    form,
    enable,
    disable,
    renderErrors,
    onSubmit,
    onSuccess,
    onError,
    endpoint,
    data
  } = config;

  const formData = new FormData(form);

  // Append data from config
  if (typeof data === 'object') {
    for (const prop in data) {
      if (typeof data[prop] === 'function') {
        formData.append(prop, data[prop].call(null, config));
      } else {
        formData.append(prop, data[prop]);
      }
    }
  }

  // Clear visible errors before submitting
  renderErrors(config, []);
  disable(config);
  onSubmit(config);

  logger('forms').log(id, 'Submitting');

  try {
    const result = await client.submitForm({
      id: id,
      endpoint: endpoint,
      data: formData
    });

    if (result.response.status == 200) {
      logger('forms').log(id, 'Submitted', result);
      onSuccess(config, result.body);
    } else {
      const errors = result.body.errors;
      logger('forms').log(id, 'Validation error', result);
      renderErrors(config, errors);
      onError(config, errors);
    }
  } catch (e) {
    logger('forms').log(id, 'Unexpected error', e);
    onFailure(config, e);
  } finally {
    enable(config);
  }
};

/**
 * Default configuration.
 */
const defaults = {
  h: h,
  onInit: onInit,
  onSubmit: onSubmit,
  onSuccess: onSuccess,
  onError: onError,
  onFailure: onFailure,
  enable: enable,
  disable: disable,
  renderErrors: renderErrors,
  endpoint: 'https://api.statickit.com',
  data: {},
  fields: {}
};

/**
 * Setup the form.
 */
const setup = (client, config) => {
  const { id, form, onInit, enable } = config;

  logger('forms').log(id, 'Initializing');

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    await submit(client, config);
    return true;
  });

  enable(config);
  onInit(config);
  return true;
};

/**
 * Look up the form element by selector or accept the given element.
 *
 * @param {Element|String} nodeOrSelector
 */
const getFormElement = nodeOrSelector => {
  if (nodeOrSelector.tagName == 'FORM') {
    return nodeOrSelector;
  } else {
    return document.querySelector(nodeOrSelector);
  }
};

const init = (client, props) => {
  if (!props.id) throw new Error('You must define an `id` property');
  if (!props.element) throw new Error('You must define an `element` property');

  const form = getFormElement(props.element);
  if (!form) throw new Error(`Element \`${props.element}\` not found`);

  const config = Object.assign({}, defaults, props, { form });
  return setup(client, config);
};

export default { init };
