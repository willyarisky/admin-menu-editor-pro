'use strict';
jQuery(function ($) {
	$(document).on('filterMenuFields.adminMenuEditor', function (event, knownMenuFields, baseField) {
		var scrollCheckboxField = $.extend({}, baseField, {
			caption: 'Hide the frame scrollbar',
			advanced: true,
			type: 'checkbox',
			standardCaption: false,

			visible: function (menuItem) {
				return wsEditorData.wsMenuEditorPro && (AmeEditorApi.getFieldValue(menuItem, 'open_in') === 'iframe');
			},

			display: function (menuItem, displayValue) {
				if (displayValue === 0 || displayValue === '0') {
					displayValue = false;
				}
				return displayValue;
			}
		});

		//Insert this field after the "iframe_height" field.
		//To do that, we back up and delete all properties.
		var backup = $.extend({}, knownMenuFields);
		$.each(backup, function (key) {
			delete knownMenuFields[key];
		});
		//Then re-insert all of the properties in the desired order.
		$.each(backup, function (key, value) {
			knownMenuFields[key] = value;
			if (key === 'iframe_height') {
				knownMenuFields['is_iframe_scroll_disabled'] = scrollCheckboxField;
			}
		});
	});

	//The "Reset permissions" toolbar button.
	$('#ws_reset_actor_permissions').click(function (event) {
		event.preventDefault();

		var selectedActor = AmeEditorApi.actorSelectorWidget.selectedActor;
		if (selectedActor === null) {
			alert(
				'This button resets all permissions for the selected role. '
				+ 'To use it, click a role and then click this button again.'
			);
			return;
		}

		var displayName = AmeEditorApi.actorSelectorWidget.selectedDisplayName;
		if (!confirm('Reset all permissions for "' + displayName + '"?')) {
			return;
		}

		//Reset CPT/taxonomy permissions and other directly granted capabilities.
		var hadGrantedCaps = AmeCapabilityManager.resetActorCaps(selectedActor);

		//Reset permissions and visibility for all menu items.
		AmeEditorApi.forEachMenuItem(function (menuItem, containerNode) {
			var wasModified = hadGrantedCaps;

			//Reset the "hide without changing permissions" settings (aka "cosmetically hidden").
			if (
				menuItem.hidden_from_actor
				&& $.isPlainObject(menuItem.hidden_from_actor)
				&& menuItem.hidden_from_actor.hasOwnProperty(selectedActor)
			) {
				delete menuItem.hidden_from_actor[selectedActor];
				wasModified = true;
			}

			//Reset permissions.
			if (
				menuItem.grant_access
				&& $.isPlainObject(menuItem.grant_access)
				&& menuItem.grant_access.hasOwnProperty(selectedActor)
			) {
				delete menuItem.grant_access[selectedActor];
				wasModified = true;
			}

			if (wasModified) {
				AmeEditorApi.updateItemEditor(containerNode);
				AmeEditorApi.updateParentAccessUi(containerNode);
			}
		});
	});
});