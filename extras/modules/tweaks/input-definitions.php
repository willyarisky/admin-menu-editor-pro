<?php

class ameUserInputDefinition {
	/**
	 * @var mixed|null
	 */
	public $defaultValue = null;
	/**
	 * @var string|null
	 */
	public $placeholder = null;
	/**
	 * @var string
	 */
	public $contentProperty = 'userInputValue';
	/**
	 * @var string
	 */
	protected $inputType = 'text';

	private static $serializableProps = array(
		'inputType',
		'defaultValue',
		'placeholder',
		'contentProperty',
	);

	public function toArray() {
		$result = array();
		foreach ($this->getSerializableProperties() as $property) {
			if ( isset($this->$property) ) {
				$result[$property] = $this->$property;
			}
		}
		return $result;
	}

	protected function getSerializableProperties() {
		return self::$serializableProps;
	}
}

class ameTweakTextAreaInput extends ameUserInputDefinition {
	protected $inputType = 'textarea';
	public $syntaxHighlighting = null;

	protected function getSerializableProperties() {
		$properties = parent::getSerializableProperties();
		$properties[] = 'syntaxHighlighting';
		return $properties;
	}
}