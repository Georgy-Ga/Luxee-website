import PropTypes from 'prop-types';
import AccountItem from './AccountItem';

/**
 * Список Luxee аккаунтов пользователя
 */
const AccountsList = ({ accounts }) => {
  return (
    <div className="mt-3 ml-6 space-y-2">
      {accounts.map((account) => (
        <AccountItem
          key={account._id}
          account={account}
        />
      ))}
    </div>
  );
};

AccountsList.propTypes = {
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      luxeeEmail: PropTypes.string.isRequired,
      aiEnabled: PropTypes.bool,
      aiEnabledByAdmin: PropTypes.bool,
    })
  ).isRequired,
};

export default AccountsList;
